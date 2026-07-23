const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { GuidanceService } = require('../src/guidance.service');

test('returns guidance for internship topics', async () => {
  const service = new GuidanceService();
  const result = await service.getGuidance({ topic: '인턴십', grade: '2학년', department: '소프트웨어개발' });

  assert.equal(result.status, 'success');
  assert.equal(result.category, 'internship');
  assert.match(result.answer, /인턴/);
});
