const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { ProfileService } = require('../src/profile.service');

test('coalesces concurrent student lookups and caches a successful not-found result', async () => {
  let calls = 0;
  const dataGsm = {
    getStudentByEmail: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return null;
    },
  };
  const fallback = {
    dataGsmStudentId: null,
    name: '홍길동',
    grade: 2,
    classNum: 1,
    number: 3,
    studentNumber: 2103,
    major: 'SW_DEVELOPMENT',
    specialty: '백엔드',
    dataGsmRole: null,
  };
  const repository = {
    getAppProfile: async (userId) => ({
      userId,
      appRole: 'STUDENT',
      interests: [],
    }),
    getProfileFallback: async () => fallback,
    saveProfileSnapshot: async () => {},
  };
  const service = new ProfileService(dataGsm, repository);
  const user = { id: 'user-id', email: 'student@gsm.hs.kr' };

  const results = await Promise.all([
    service.resolve(user),
    service.resolve(user),
    service.resolve(user),
  ]);
  await service.resolve(user);

  assert.equal(calls, 1);
  assert.equal(results[0].meta.profileSource, 'LOCAL_PROFILE');
  assert.equal(results[0].profile.grade, 2);
  assert.deepEqual(await service.resolveForAi(user), {
    grade: '2학년',
    department: results[0].profile.department,
  });
});

test('rejects an incomplete trusted profile before AI use', async () => {
  const service = new ProfileService(
    { getStudentByEmail: async () => null },
    {
      getAppProfile: async (userId) => ({
        userId,
        appRole: 'STUDENT',
        interests: [],
      }),
      getProfileFallback: async () => ({
        dataGsmStudentId: null,
        name: '학생',
        grade: null,
        classNum: null,
        number: null,
        studentNumber: 2103,
        major: 'SW_DEVELOPMENT',
        specialty: null,
        dataGsmRole: null,
      }),
      saveProfileSnapshot: async () => {},
    },
  );

  await assert.rejects(
    service.resolveForAi({
      id: 'incomplete-user',
      email: 'student@gsm.hs.kr',
    }),
    (error) =>
      error.code === 'PROFILE_INCOMPLETE' && error.getStatus() === 400,
  );
});
