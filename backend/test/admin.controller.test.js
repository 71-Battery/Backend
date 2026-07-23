const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { AdminController } = require('../src/admin.controller');

test('creates and lists admin rules', async () => {
  const controller = new AdminController();
  const created = await controller.createRule({ title: '시험 일정', content: '시험은 5월 1일입니다.', category: 'schedule' });
  const listed = controller.getRules();

  assert.equal(created.status, 'success');
  assert.equal(listed.rules.length, 1);
  assert.equal(listed.rules[0].title, '시험 일정');
});
