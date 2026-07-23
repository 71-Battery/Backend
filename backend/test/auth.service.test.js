const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { AuthService } = require('../src/auth.service');

test('registers a user and returns a signed token', async () => {
  const service = new AuthService();
  const result = await service.signup('newstudent@example.com', 'password123', '새 학생');

  assert.equal(result.status, 'success');
  assert.ok(result.token);
  assert.equal(result.user.email, 'newstudent@example.com');
  assert.equal(result.user.name, '새 학생');
});

test('allows the new user to log in and rejects duplicate registration', async () => {
  const service = new AuthService();
  await service.signup('student@example.com', 'password123');

  const loginResult = await service.login('student@example.com', 'password123');
  const duplicate = await service.signup('student@example.com', 'password123');

  assert.equal(loginResult.status, 'success');
  assert.equal(duplicate.status, 'error');
});

test('verifies a signed token and rejects a tampered token', async () => {
  const service = new AuthService();
  const signupResult = await service.signup('student@example.com', 'password123');

  const verified = await service.verifyToken(signupResult.token);
  const tampered = await service.verifyToken(`${signupResult.token}x`);

  assert.equal(verified.email, 'student@example.com');
  assert.equal(verified.role, 'student');
  assert.equal(tampered, null);
});
