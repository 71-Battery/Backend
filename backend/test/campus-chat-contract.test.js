const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { ApiException } = require('../src/common/api-exception');
const {
  CampusChatAuthGuard,
} = require('../src/campus-ai/campus-chat-auth.guard');
const {
  CampusChatExceptionFilter,
} = require('../src/campus-ai/campus-chat-exception.filter');

function executionContext(request) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

test('v1 auth guard rejects a missing token with UNAUTHORIZED', async () => {
  const guard = new CampusChatAuthGuard({
    verifyAccessToken: async () => {
      throw new Error('must not be called');
    },
  });

  await assert.rejects(
    guard.canActivate(executionContext({ headers: {} })),
    (error) =>
      error.code === 'UNAUTHORIZED' && error.getStatus() === 401,
  );
});

test('v1 auth guard verifies a Bearer token and attaches the user', async () => {
  const user = { id: 'user-id', email: 'student@gsm.hs.kr' };
  const request = { headers: { authorization: 'Bearer valid-token' } };
  const guard = new CampusChatAuthGuard({
    verifyAccessToken: async (token) =>
      token === 'valid-token' ? user : null,
  });

  assert.equal(await guard.canActivate(executionContext(request)), true);
  assert.deepEqual(request.user, user);
});

test('v1 error filter returns the strict request_id contract', () => {
  let status;
  let body;
  const response = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  };
  const exception = new ApiException(
    'CAMPUS_AI_TIMEOUT',
    'AI 응답 시간이 초과되었습니다.',
    504,
    'ai-request-id',
  );

  new CampusChatExceptionFilter().catch(exception, host);

  assert.equal(status, 504);
  assert.deepEqual(body, {
    error: {
      code: 'CAMPUS_AI_TIMEOUT',
      message: 'AI 응답 시간이 초과되었습니다.',
      request_id: 'ai-request-id',
    },
  });
});

test('v1 filter hides unexpected internal errors', () => {
  let status;
  let body;
  const response = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  };

  new CampusChatExceptionFilter().catch(
    new Error('database password: secret'),
    host,
  );

  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.doesNotMatch(body.error.message, /secret/);
  assert.equal(typeof body.error.request_id, 'string');
});

test('POST /api/v1/chat applies the v1 auth and error contract', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '질문' }),
      },
    );
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'UNAUTHORIZED');
    assert.equal(typeof body.error.request_id, 'string');
    assert.deepEqual(Object.keys(body), ['error']);
  } finally {
    await app.close();
  }
});
