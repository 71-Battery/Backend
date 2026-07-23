const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { StorageService } = require('../src/storage.service');

test('falls back to memory storage when Supabase is not configured', async () => {
  const service = new StorageService(null, false);
  const result = await service.saveChatLog({ message: '테스트', answer: '응답' });

  assert.equal(result.status, 'saved');
  assert.equal(result.storage, 'memory');
  assert.equal(result.entry.message, '테스트');
});
