const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { NotificationsService } = require('../src/notifications.service');

test('filters Campus AI notices for the authenticated student and sanitizes output', async () => {
  const service = new NotificationsService(
    {
      listNotices: async () => ({
        count: 3,
        notices: [
          {
            id: 'matched',
            title: '<strong>현장실습</strong><script>alert(1)</script>',
            content: '<img src=x onerror=alert(1)>신청서를 제출하세요.',
            type: 'notice',
            starts_at: '2026-08-01T09:00:00+09:00',
            source_id: 'school-123',
            url: 'https://gsm.hs.kr/notices/123',
            target_grade: '3학년',
            target_department: '소프트웨어개발과',
            created_at: '2026-07-24T00:00:00Z',
            summary: '<b>8월 1일까지 신청</b>',
            summary_provider: 'bedrock',
            notified: true,
          },
          {
            id: 'wrong-grade',
            title: '1학년 공지',
            content: '',
            type: 'notice',
            target_grade: '1학년',
            target_department: '전체',
            created_at: '2026-07-24T00:00:00Z',
            notified: false,
          },
          {
            id: 'wrong-department',
            title: '다른 학과 공지',
            content: '',
            type: 'notice',
            target_grade: '전체',
            target_department: '인공지능과',
            created_at: '2026-07-24T00:00:00Z',
            notified: false,
          },
        ],
      }),
    },
    {
      resolve: async () => ({
        profile: {
          grade: 3,
          department: '소프트웨어개발과',
        },
      }),
    },
  );

  const result = await service.listForUser({
    id: 'user-id',
    email: 'student@gsm.hs.kr',
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'ai-notice:matched');
  assert.equal(result[0].title, '현장실습');
  assert.equal(result[0].content, '신청서를 제출하세요.');
  assert.equal(result[0].summary, '8월 1일까지 신청');
  assert.equal(result[0].sourceUrl, 'https://gsm.hs.kr/notices/123');
  assert.deepEqual(result[0].targetGrades, [3]);
  assert.deepEqual(result[0].targetMajors, ['SW_DEVELOPMENT']);
  assert.equal(result[0].isProactive, true);
});

test('drops unsafe notification source URLs', async () => {
  const service = new NotificationsService(
    {
      listNotices: async () => ({
        count: 1,
        notices: [
          {
            id: 'notice',
            title: '공지',
            content: '내용',
            type: 'notice',
            url: 'javascript:alert(1)',
            target_grade: '전체',
            target_department: '전체',
            created_at: '2026-07-24T00:00:00Z',
            notified: false,
          },
        ],
      }),
    },
    {
      resolve: async () => ({
        profile: { grade: 2, department: '스마트IoT과' },
      }),
    },
  );

  const [notice] = await service.listForUser({
    id: 'user-id',
    email: 'student@gsm.hs.kr',
  });
  assert.equal(notice.sourceUrl, null);
});
