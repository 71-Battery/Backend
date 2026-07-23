const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
require('ts-node/register/transpile-only');

const { CampusAiClient } = require('../src/campus-ai/campus-ai.client');

const ENV_KEYS = [
  'CAMPUS_AI_API_URL',
  'CAMPUS_AI_TOP_K',
  'CAMPUS_AI_SCORE_THRESHOLD',
  'CAMPUS_AI_CONNECT_TIMEOUT',
  'CAMPUS_AI_READ_TIMEOUT',
];

const trustedProfile = {
  grade: '3학년',
  department: '소프트웨어개발과',
};

function response(overrides = {}) {
  return {
    answer: '현장실습 안내입니다.',
    profile: {
      grade: '1학년',
      department: '신뢰하면 안 되는 값',
    },
    sources: [
      {
        category: '기업 협력사',
        document: '01_기업_협력사.md',
        snippet: '현장실습 신청 근거',
        score: 1.343869,
      },
    ],
    has_context: true,
    retrieval: {
      top_k: 4,
      score_threshold: 1.5,
      matched: true,
    },
    request_id: '3091d4dc-9db1-41c2-a459-47712ee06e4b',
    ...overrides,
  };
}

async function withCampusEnv(run) {
  const previousEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  const previousFetch = global.fetch;
  process.env.CAMPUS_AI_API_URL = 'https://campus-ai.test';
  process.env.CAMPUS_AI_TOP_K = '6';
  process.env.CAMPUS_AI_SCORE_THRESHOLD = '1.25';
  process.env.CAMPUS_AI_CONNECT_TIMEOUT = '5';
  process.env.CAMPUS_AI_READ_TIMEOUT = '60';
  try {
    await run();
  } finally {
    global.fetch = previousFetch;
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  }
}

test('sends only server settings and overwrites the upstream profile', async () => {
  await withCampusEnv(async () => {
    let capturedUrl;
    let capturedOptions;
    global.fetch = async (url, options) => {
      capturedUrl = new URL(url);
      capturedOptions = options;
      return new Response(JSON.stringify(response()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const client = new CampusAiClient();
    const result = await client.chat('현장실습은 어떻게 신청해?', trustedProfile);

    assert.equal(capturedUrl.pathname, '/v1/chat');
    assert.deepEqual(JSON.parse(capturedOptions.body), {
      query: '현장실습은 어떻게 신청해?',
      grade: '3학년',
      department: '소프트웨어개발과',
      top_k: 6,
      score_threshold: 1.25,
    });
    assert.deepEqual(result.profile, trustedProfile);
    assert.equal(result.sources[0].document, '01_기업_협력사.md');
  });
});

test('accepts a valid no-context response', async () => {
  await withCampusEnv(async () => {
    global.fetch = async () =>
      new Response(
        JSON.stringify(
          response({
            sources: [],
            has_context: false,
            retrieval: {
              top_k: 4,
              score_threshold: 1.5,
              matched: false,
            },
          }),
        ),
        { status: 200 },
      );

    const result = await new CampusAiClient().chat('범위 밖 질문', trustedProfile);
    assert.equal(result.has_context, false);
    assert.deepEqual(result.sources, []);
  });
});

test('maps known upstream errors without exposing the upstream message', async () => {
  await withCampusEnv(async () => {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'KNOWLEDGE_BASE_UNAVAILABLE',
            message: 'internal index path: /secret/faiss',
            request_id: 'upstream-request-id',
          },
        }),
        { status: 503 },
      );

    await assert.rejects(
      new CampusAiClient().chat('질문', trustedProfile),
      (error) =>
        error.code === 'KNOWLEDGE_BASE_UNAVAILABLE' &&
        error.getStatus() === 503 &&
        error.requestId === 'upstream-request-id' &&
        !error.message.includes('/secret/faiss'),
    );
  });
});

test('rejects malformed success responses', async () => {
  await withCampusEnv(async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ answer: '필수 필드 누락' }), {
        status: 200,
      });

    await assert.rejects(
      new CampusAiClient().chat('질문', trustedProfile),
      (error) =>
        error.code === 'INVALID_AI_RESPONSE' && error.getStatus() === 502,
    );
  });
});

test('maps network failures and aborts to safe errors', async () => {
  await withCampusEnv(async () => {
    global.fetch = async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1');
    };
    await assert.rejects(
      new CampusAiClient().chat('질문', trustedProfile),
      (error) =>
        error.code === 'CAMPUS_AI_UNAVAILABLE' &&
        !error.message.includes('127.0.0.1'),
    );

    global.fetch = async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    };
    await assert.rejects(
      new CampusAiClient().chat('질문', trustedProfile),
      (error) =>
        error.code === 'CAMPUS_AI_TIMEOUT' && error.getStatus() === 504,
    );
  });
});

test('rejects a public plaintext Campus AI origin', async () => {
  await withCampusEnv(async () => {
    process.env.CAMPUS_AI_API_URL = 'http://campus-ai.test';
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return new Response();
    };

    await assert.rejects(
      new CampusAiClient().chat('질문', trustedProfile),
      (error) =>
        error.code === 'CAMPUS_AI_INSECURE_URL' &&
        error.getStatus() === 503,
    );
    assert.equal(calls, 0);
  });
});

test('works through the configured dispatcher against a loopback service', async () => {
  const server = http.createServer((request, responseStream) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const requestBody = JSON.parse(body);
      responseStream.writeHead(200, { 'content-type': 'application/json' });
      responseStream.end(
        JSON.stringify(
          response({
            answer: requestBody.query,
            profile: {
              grade: requestBody.grade,
              department: requestBody.department,
            },
          }),
        ),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  try {
    await withCampusEnv(async () => {
      process.env.CAMPUS_AI_API_URL = `http://127.0.0.1:${address.port}`;
      const client = new CampusAiClient();
      try {
        const result = await client.chat('로컬 통합 확인', trustedProfile);
        assert.equal(result.answer, '로컬 통합 확인');
      } finally {
        await client.onModuleDestroy();
      }
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
