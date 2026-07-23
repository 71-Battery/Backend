const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { ApiException } = require('../src/common/api-exception');
const { ChatService } = require('../src/chat.service');

const user = { id: 'user-id', email: 'student@gsm.hs.kr' };
const trustedProfile = {
  grade: '2학년',
  department: '소프트웨어개발과',
};

function campusResponse() {
  return {
    answer: '서버 프로필을 반영한 답변입니다.',
    profile: trustedProfile,
    sources: [
      {
        category: '교육과정',
        document: '교육과정.md',
        snippet: '답변 근거입니다.',
        score: 1.2,
      },
    ],
    has_context: true,
    retrieval: {
      top_k: 4,
      score_threshold: 1.5,
      matched: true,
    },
    request_id: '3091d4dc-9db1-41c2-a459-47712ee06e4b',
  };
}

test('new chat uses only the authenticated server profile', async () => {
  let captured;
  const service = new ChatService(
    { resolveForAi: async () => trustedProfile },
    {
      chat: async (query, profile) => {
        captured = { query, profile };
        return campusResponse();
      },
    },
  );

  const result = await service.createV1Chat(user, {
    query: '  현장실습은 어떻게 신청해?  ',
    grade: '공격자가 보낸 학년',
    department: '공격자가 보낸 학과',
    top_k: 100,
    score_threshold: 999,
  });

  assert.deepEqual(captured, {
    query: '현장실습은 어떻게 신청해?',
    profile: trustedProfile,
  });
  assert.equal(result.answer, '서버 프로필을 반영한 답변입니다.');
});

test('legacy endpoint keeps its envelope while using Campus AI', async () => {
  const conversationId = '8093648a-9eb5-431b-9942-166ba3f2bfcc';
  const service = new ChatService(
    { resolveForAi: async () => trustedProfile },
    { chat: async () => campusResponse() },
  );

  const result = await service.generateResponse(user, {
    message: '이번 달 학사 일정은?',
    conversationId,
    grade: '클라이언트 학년',
    department: '클라이언트 학과',
  });

  assert.equal(result.status, 'OK');
  assert.equal(result.data.conversationId, conversationId);
  assert.equal(result.data.has_context, true);
  assert.equal(result.data.sources[0].document, '교육과정.md');
});

test('rejects empty and over-1,000-character questions before Campus AI', async () => {
  let calls = 0;
  const service = new ChatService(
    { resolveForAi: async () => trustedProfile },
    {
      chat: async () => {
        calls += 1;
        return campusResponse();
      },
    },
  );

  await assert.rejects(
    service.createV1Chat(user, { query: '   ' }),
    (error) => error.code === 'INVALID_REQUEST' && error.getStatus() === 400,
  );
  await assert.rejects(
    service.generateResponse(user, { message: '가'.repeat(1001) }),
    (error) => error.code === 'QUERY_TOO_LONG' && error.getStatus() === 400,
  );
  assert.equal(calls, 0);
});

test('does not call Campus AI when the trusted profile is incomplete', async () => {
  let calls = 0;
  const service = new ChatService(
    {
      resolveForAi: async () => {
        throw new ApiException(
          'PROFILE_INCOMPLETE',
          '프로필 정보가 필요합니다.',
          400,
        );
      },
    },
    {
      chat: async () => {
        calls += 1;
        return campusResponse();
      },
    },
  );

  await assert.rejects(
    service.createV1Chat(user, { query: '질문' }),
    (error) => error.code === 'PROFILE_INCOMPLETE',
  );
  assert.equal(calls, 0);
});

test('maps a missing student profile to USER_NOT_FOUND', async () => {
  const service = new ChatService(
    {
      resolveForAi: async () => {
        throw new ApiException(
          'STUDENT_PROFILE_NOT_FOUND',
          '학생 정보 없음',
          404,
        );
      },
    },
    { chat: async () => campusResponse() },
  );

  await assert.rejects(
    service.createV1Chat(user, { query: '질문' }),
    (error) => error.code === 'USER_NOT_FOUND' && error.getStatus() === 404,
  );
});
