const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { ContentAdminGuard } = require('../src/app-role.guard');

function context(user) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

test('allows only internal app content roles', async () => {
  const adminGuard = new ContentAdminGuard({
    getAppProfile: async () => ({
      appRole: 'ADMIN',
      interests: [],
      userId: 'user-id',
    }),
  });
  const studentGuard = new ContentAdminGuard({
    getAppProfile: async () => ({
      appRole: 'STUDENT',
      interests: [],
      userId: 'user-id',
    }),
  });
  const user = { id: 'user-id', email: 'student@gsm.hs.kr' };

  assert.equal(await adminGuard.canActivate(context(user)), true);
  await assert.rejects(
    studentGuard.canActivate(context(user)),
    (error) => error.code === 'CONTENT_ADMIN_REQUIRED',
  );
});
