const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const { ChatService } = require('../src/chat.service');

test('returns an internship-focused answer for internship questions', async () => {
  const service = new ChatService();
  const result = await service.generateResponse({
    message: '인턴십 준비 어떻게 해?',
    grade: '2학년',
    department: '소프트웨어개발',
  });

  assert.equal(result.status, 'success');
  assert.equal(result.category, 'internship');
  assert.match(result.answer, /인턴/);
});

test('returns a schedule-focused answer for schedule questions', async () => {
  const service = new ChatService();
  const result = await service.generateResponse({
    message: '학사 일정 알려줘',
    grade: '3학년',
    department: 'AI',
  });

  assert.equal(result.status, 'success');
  assert.equal(result.category, 'schedule');
  assert.match(result.answer, /일정/);
});
