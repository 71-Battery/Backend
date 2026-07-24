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

test('sanitizes legacy notice and regulation rows when reading them', () => {
  const repository = new RepositoryService({
    hasDatabaseConfig: true,
  });

  const mapped = repository.mapNotice({
    id: 'notice-id',
    title: '<strong>공지</strong><script>alert(1)</script>',
    summary: '<img src=x onerror=alert(1)>요약',
    content:
      '<em>본문</em><img src=x onerror=alert(1)>' +
      '<a href="javascript:alert(1)">위험한 링크</a>',
    category: '<b>학교생활</b>',
    department: '<i>학생부</i>',
    published_at: '2026-07-24T00:00:00.000Z',
    deadline_at: null,
    target_grades: [],
    target_majors: [],
    source_url: null,
    version: 1,
    updated_at: '2026-07-24T00:00:00.000Z',
  });

  assert.equal(mapped.title, '공지');
  assert.equal(mapped.summary, '요약');
  assert.equal(
    mapped.content,
    '<em>본문</em><a rel="noopener noreferrer nofollow">위험한 링크</a>',
  );
  assert.equal(mapped.category, '학교생활');
  assert.equal(mapped.department, '학생부');
});
