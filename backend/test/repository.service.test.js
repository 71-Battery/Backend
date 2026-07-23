const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { RepositoryService } = require('../src/repository.service');

test('uses the explicitly enabled non-production memory repository', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFallback = process.env.ALLOW_IN_MEMORY_REPOSITORY;
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_IN_MEMORY_REPOSITORY = 'true';
  try {
    const repository = new RepositoryService({
      hasDatabaseConfig: false,
    });
    await repository.saveResource('user-id', 'SCHEDULE', 'schedule-1');
    const saved = await repository.getSavedResources('user-id');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].resourceId, 'schedule-1');
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.ALLOW_IN_MEMORY_REPOSITORY = previousFallback;
  }
});
