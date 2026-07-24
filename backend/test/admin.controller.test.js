const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { ContentAdminGuard } = require('../src/app-role.guard');
const { AdminController } = require('../src/admin.controller');

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

test('sanitizes a regulation immediately before repository storage', async () => {
  let storedInput;
  const controller = new AdminController({
    createRegulation: async (input) => {
      storedInput = input;
      return { id: 'rule-id', ...input };
    },
  });

  await controller.createRule(
    { id: 'editor-id', email: 'editor@gsm.hs.kr' },
    {
      title: '<strong>생활 규정</strong><script>alert(1)</script>',
      content:
        '<strong>중요</strong><img src=x onerror=alert(1)>' +
        '<a href="javascript:alert(1)" onclick="alert(1)">링크</a>' +
        '<a href="https://gsm.hs.kr" onmouseover="alert(1)">학교</a>',
      category: '<em>학교생활</em>',
    },
  );

  assert.deepEqual(storedInput, {
    title: '생활 규정',
    content:
      '<strong>중요</strong>' +
      '<a rel="noopener noreferrer nofollow">링크</a>' +
      '<a href="https://gsm.hs.kr" rel="noopener noreferrer nofollow">학교</a>',
    category: '학교생활',
    userId: 'editor-id',
  });
});

test('rejects a regulation whose content is empty after sanitization', async () => {
  let repositoryCalled = false;
  const controller = new AdminController({
    createRegulation: async () => {
      repositoryCalled = true;
    },
  });

  await assert.rejects(
    controller.createRule(
      { id: 'editor-id', email: 'editor@gsm.hs.kr' },
      {
        title: '생활 규정',
        content: '<script>alert(1)</script>',
        category: '학교생활',
      },
    ),
    (error) =>
      error.code === 'INVALID_REGULATION' && error.getStatus() === 400,
  );
  assert.equal(repositoryCalled, false);
});
