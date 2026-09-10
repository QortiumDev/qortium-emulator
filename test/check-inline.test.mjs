import assert from 'node:assert/strict';
import test from 'node:test';
import { extractInlineScripts } from '../scripts/check-inline.mjs';

test('extracts case-insensitive script names with proper boundaries', () => {
  const scripts = extractInlineScripts([
    '<SCRIPT type="module">globalThis.upper = true;</SCRIPT >',
    '<scripture>ignored</scripture>',
    '<script>globalThis.lower = true;</script>'
  ].join(''));
  assert.equal(scripts.length, 2);
  assert.match(scripts[0], /upper/);
  assert.match(scripts[1], /lower/);
});

test('handles quoted greater-than characters and skips external scripts', () => {
  const scripts = extractInlineScripts([
    '<script data-value=">">globalThis.inline = true;</script>',
    '<script src="https://example.invalid/app.js" data-value=">">ignored</script >',
    '<script defer src="external.js">ignored too</script>'
  ].join(''));
  assert.deepEqual(scripts, ['globalThis.inline = true;']);
});

test('skips scripts inside HTML comments', () => {
  const scripts = extractInlineScripts([
    '<!-- <script>globalThis.comment = true;</script> -->',
    '<script>globalThis.real = true;</script>'
  ].join(''));
  assert.deepEqual(scripts, ['globalThis.real = true;']);
});

test('accepts closing-tag whitespace and attributes without consuming later markup', () => {
  const scripts = extractInlineScripts(
    '<script>globalThis.first = true;</script data-note="quoted > value">' +
    '<script>globalThis.second = true;</script>'
  );
  assert.equal(scripts.length, 2);
  assert.match(scripts[0], /first/);
  assert.match(scripts[1], /second/);
});

test('throws for an unterminated script element', () => {
  assert.throws(
    () => extractInlineScripts('<script>globalThis.unfinished = true;'),
    /Unterminated <script> element/
  );
});
