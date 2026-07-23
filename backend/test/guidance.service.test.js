const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { GuidanceService } = require('../src/guidance.service');

test('builds personalized guidance from server-side context', async () => {
  const service = new GuidanceService({
    build: async () => ({
      student: {
        grade: 2,
        major: 'SW_DEVELOPMENT',
        majorLabel: '소프트웨어개발과',
        specialty: '백엔드',
      },
      schedules: [],
      notices: [
        {
          id: 'notice-1',
          title: '인턴십 사전교육',
          summary: '인턴십 준비 안내',
          category: '인턴십',
          publishedAt: '2026-07-21T09:00:00+09:00',
          deadlineAt: null,
        },
      ],
      regulations: [],
    }),
  });

  const result = await service.getGuidance(
    { id: 'user-id', email: 'student@gsm.hs.kr' },
    { topic: '인턴십', grade: '신뢰하면 안 됨' },
  );

  assert.equal(result.status, 'OK');
  assert.match(result.data.answer, /2학년/);
  assert.equal(result.data.sources[0].type, 'NOTICE');
});
