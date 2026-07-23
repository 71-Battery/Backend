const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { DataGsmClient } = require('../src/data-gsm/data-gsm.client');

test('queries one enrolled student and validates the exact response email', async () => {
  const previousKey = process.env.DATA_GSM_API_KEY;
  const previousFetch = global.fetch;
  process.env.DATA_GSM_API_KEY = 'test-only-fake-key';
  let requestUrl;
  let requestOptions;
  global.fetch = async (url, options) => {
    requestUrl = new URL(url);
    requestOptions = options;
    return new Response(
      JSON.stringify({
        status: 200,
        data: {
          students: [
            {
              id: 1,
              name: '홍길동',
              email: 'student@gsm.hs.kr',
              grade: 2,
              classNum: 1,
              number: 3,
              studentNumber: 2103,
              major: 'SW_DEVELOPMENT',
              specialty: '백엔드',
              role: 'GENERAL_STUDENT',
            },
          ],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const client = new DataGsmClient();
    const student = await client.getStudentByEmail('student@gsm.hs.kr');
    assert.equal(student.name, '홍길동');
    assert.equal(requestUrl.pathname, '/v1/students');
    assert.equal(requestUrl.searchParams.get('email'), 'student@gsm.hs.kr');
    assert.equal(requestUrl.searchParams.get('onlyEnrolled'), 'true');
    assert.equal(requestUrl.searchParams.get('page'), '0');
    assert.equal(requestUrl.searchParams.get('size'), '1');
    assert.equal(requestOptions.headers['X-API-KEY'], 'test-only-fake-key');
  } finally {
    global.fetch = previousFetch;
    process.env.DATA_GSM_API_KEY = previousKey;
  }
});

test('maps a provider 401 to a distinct safe upstream error', async () => {
  const previousKey = process.env.DATA_GSM_API_KEY;
  const previousFetch = global.fetch;
  process.env.DATA_GSM_API_KEY = 'test-only-fake-key';
  global.fetch = async () => new Response('secret provider body', { status: 401 });
  try {
    const client = new DataGsmClient();
    await assert.rejects(
      client.getStudentByEmail('student@gsm.hs.kr'),
      (error) =>
        error.code === 'DATA_PROVIDER_AUTH_ERROR' &&
        !error.message.includes('secret provider body'),
    );
  } finally {
    global.fetch = previousFetch;
    process.env.DATA_GSM_API_KEY = previousKey;
  }
});
