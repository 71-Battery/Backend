const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const {
  ContentAdminGuard,
  SystemAdminGuard,
} = require('../src/app-role.guard');
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

test('allows member and role management only for system admins', async () => {
  const adminGuard = new SystemAdminGuard({
    getAppProfile: async () => ({ appRole: 'ADMIN' }),
  });
  const editorGuard = new SystemAdminGuard({
    getAppProfile: async () => ({ appRole: 'CONTENT_EDITOR' }),
  });
  const user = { id: 'user-id', email: 'admin@gsm.hs.kr' };

  assert.equal(await adminGuard.canActivate(context(user)), true);
  await assert.rejects(
    editorGuard.canActivate(context(user)),
    (error) => error.code === 'SYSTEM_ADMIN_REQUIRED',
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

test('sanitizes a notice before publishing it', async () => {
  let storedInput;
  let aiInput;
  let invalidated = false;
  const controller = new AdminController(
    {
      createNotice: async (input) => {
        storedInput = input;
        return {
          id: 'notice-id',
          sourceUrl: null,
          ...input,
        };
      },
    },
    {
      ingestNotice: async (input) => {
        aiInput = input;
        return {
          skipped: false,
          notice: { notified: true },
          notify_results: [{ channel: 'console', ok: true }],
        };
      },
    },
    {
      invalidateNotices: () => {
        invalidated = true;
      },
    },
  );

  const response = await controller.createNotice(
    { id: 'editor-id', email: 'editor@gsm.hs.kr' },
    {
      title: '<b>학사 공지</b>',
      summary: '<img src=x onerror=alert(1)>필독',
      content: '<em>본문</em><script>alert(1)</script>',
      category: '<strong>학교생활</strong>',
    },
  );

  assert.deepEqual(storedInput, {
    title: '학사 공지',
    summary: '필독',
    content: '<em>본문</em>',
    category: '학교생활',
    userId: 'editor-id',
  });
  assert.deepEqual(aiInput, {
    title: '학사 공지',
    content: '<em>본문</em>',
    type: 'notice',
    sourceId: 'notice-id',
    url: null,
    targetGrade: '전체',
    targetDepartment: '전체',
  });
  assert.equal(invalidated, true);
  assert.deepEqual(response.data.notification, {
    status: 'DELIVERED',
    notified: true,
    channels: [{ channel: 'console', ok: true }],
  });
});

test('updates and deletes a validated prefixed regulation id', async () => {
  const calls = [];
  const controller = new AdminController({
    updateRegulation: async (id, input) => {
      calls.push(['update', id, input]);
      return { id, ...input };
    },
    deleteRegulation: async (id) => calls.push(['delete', id]),
  });
  const id = 'rule-db742cb0-f333-4b7b-a214-9444c23da582';

  await controller.updateRule(id, {
    title: '수정 규정',
    content: '<strong>안전한 본문</strong>',
    category: '학교생활',
  });
  await controller.deleteRule(id);

  assert.deepEqual(calls, [
    [
      'update',
      id,
      {
        title: '수정 규정',
        content: '<strong>안전한 본문</strong>',
        category: '학교생활',
      },
    ],
    ['delete', id],
  ]);
});

test('prevents an administrator from changing their own role', async () => {
  const controller = new AdminController({
    updateAppRole: async () => {
      throw new Error('repository must not be called');
    },
  });
  const id = 'db742cb0-f333-4b7b-a214-9444c23da582';

  await assert.rejects(
    controller.updateUserRole(
      { id, email: 'admin@gsm.hs.kr' },
      id,
      { appRole: 'STUDENT' },
    ),
    (error) => error.code === 'SELF_ROLE_CHANGE_NOT_ALLOWED',
  );
});
