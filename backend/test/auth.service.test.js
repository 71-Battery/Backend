const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { AuthService } = require('../src/auth.service');

test('returns a signed token for valid credentials', async () => {
  const service = new AuthService();
  const result = await service.login('student@example.com', 'password123');

  assert.equal(result.status, 'success');
  assert.ok(result.token);
  assert.equal(result.user.email, 'student@example.com');
});

test('verifies a signed token successfully', async () => {
  const service = new AuthService();
  const loginResult = await service.login('student@example.com', 'password123');
  const verified = await service.verifyToken(loginResult.token);

  assert.equal(verified.email, 'student@example.com');
  assert.equal(verified.role, 'student');
});
