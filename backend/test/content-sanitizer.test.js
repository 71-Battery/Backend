const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');

const {
  sanitizeAdminContent,
  sanitizeAdminPlainText,
} = require('../src/content-sanitizer');

test('removes script elements, event handlers, and non-whitelisted tags', () => {
  assert.equal(
    sanitizeAdminContent(
      '앞<script>alert(1)</script><img src=x onerror=alert(1)>뒤',
    ),
    '앞뒤',
  );
});

test('retains only safe inline formatting and safe links', () => {
  assert.equal(
    sanitizeAdminContent(
      '<strong>굵게</strong><em>기울임</em>' +
        '<a href="https://gsm.hs.kr" title="학교" onclick="alert(1)">링크</a>',
    ),
    '<strong>굵게</strong><em>기울임</em>' +
      '<a href="https://gsm.hs.kr" title="학교" rel="noopener noreferrer nofollow">링크</a>',
  );
});

test('removes unsafe link protocols and all markup from plain text fields', () => {
  assert.equal(
    sanitizeAdminContent('<a href="javascript:alert(1)">링크</a>'),
    '<a rel="noopener noreferrer nofollow">링크</a>',
  );
  assert.equal(
    sanitizeAdminPlainText('<strong>제목</strong><script>alert(1)</script>'),
    '제목',
  );
});
