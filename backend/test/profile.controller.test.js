const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { ProfileService } = require('../src/profile.service');

test('maps the exact Data-GSM student to the public profile DTO', async () => {
  let calls = 0;
  const dataGsm = {
    getStudentByEmail: async () => {
      calls += 1;
      return {
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
      };
    },
  };
  const repository = {
    getAppProfile: async () => ({
      userId: 'user-id',
      appRole: 'STUDENT',
      interests: ['인턴십'],
    }),
    getProfileFallback: async () => null,
    saveProfileSnapshot: async () => undefined,
  };
  const service = new ProfileService(dataGsm, repository);
  const user = { id: 'user-id', email: 'student@gsm.hs.kr' };

  const result = await service.resolve(user);
  await service.resolve(user);

  assert.equal(result.profile.department, '소프트웨어개발과');
  assert.equal(result.profile.schoolEmail, 'student@gsm.hs.kr');
  assert.equal(result.permissions.canManageContent, false);
  assert.equal(result.meta.profileSource, 'DATA_GSM');
  assert.equal(calls, 1, 'successful profiles should be cached');
});

test('uses the local profile when the student is not returned', async () => {
  const service = new ProfileService(
    { getStudentByEmail: async () => null },
    {
      getAppProfile: async () => ({
        userId: 'user-id',
        appRole: 'STUDENT',
        interests: [],
      }),
      getProfileFallback: async () => ({
        dataGsmStudentId: null,
        name: '로컬 학생',
        grade: null,
        classNum: null,
        number: null,
        studentNumber: 2103,
        major: null,
        specialty: null,
        dataGsmRole: null,
      }),
      saveProfileSnapshot: async () => undefined,
    },
  );

  const result = await service.resolve({
    id: 'user-id',
    email: 'student@gsm.hs.kr',
  });

  assert.equal(result.meta.fallback, true);
  assert.equal(result.profile.studentNumber, 2103);
});
