const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { ProfileController } = require('../src/profile.controller');
const { AuthService } = require('../src/auth.service');

test('returns profile for valid bearer token', async () => {
  const authService = new AuthService();
  const controller = new ProfileController(authService);
  const loginResult = await authService.login('student@example.com', 'password123');
  const profile = await controller.getProfile(`Bearer ${loginResult.token}`);

  assert.equal(profile.status, 'success');
  assert.equal(profile.user.email, 'student@example.com');
});
