const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { ChatController } = require('../src/chat.controller');

test('routes both chat contracts through the shared chat service', async () => {
  const calls = [];
  const controller = new ChatController({
    createV1Chat: async (user, body) => {
      calls.push(['v1', user, body]);
      return { answer: 'v1' };
    },
    generateResponse: async (user, body) => {
      calls.push(['legacy', user, body]);
      return { status: 'OK' };
    },
  });
  const user = { id: 'user-id', email: 'student@gsm.hs.kr' };

  assert.deepEqual(
    await controller.createV1Chat(user, { query: '질문' }),
    { answer: 'v1' },
  );
  assert.deepEqual(
    await controller.createLegacyChat(user, { message: '질문' }),
    { status: 'OK' },
  );
  assert.deepEqual(calls.map(([route]) => route), ['v1', 'legacy']);
});
