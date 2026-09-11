import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';

function isWhitespace(value) {
  return value !== undefined && /\s/.test(value);
}

function hasTagBoundary(value) {
  return value === undefined || value === '>' || value === '/' || isWhitespace(value);
}

function findTagEnd(html, start) {
  let quote = '';
  for (let index = start; index < html.length; index += 1) {
    const value = html[index];
    if (quote) {
      if (value === quote) quote = '';
    } else if (value === '"' || value === "'") {
      quote = value;
    } else if (value === '>') {
      return index;
    }
  }
  return -1;
}

function hasSrcAttribute(html, start, end) {
  let index = start;
  while (index < end) {
    while (index < end && (isWhitespace(html[index]) || html[index] === '/')) index += 1;
    const nameStart = index;
    while (index < end && !isWhitespace(html[index]) && html[index] !== '=' && html[index] !== '/') index += 1;
    if (html.slice(nameStart, index).toLowerCase() === 'src') return true;
    while (index < end && isWhitespace(html[index])) index += 1;
    if (html[index] === '=') {
      index += 1;
      while (index < end && isWhitespace(html[index])) index += 1;
      const quote = html[index] === '"' || html[index] === "'" ? html[index++] : '';
      while (index < end && (quote ? html[index] !== quote : !isWhitespace(html[index]))) index += 1;
      if (quote && html[index] === quote) index += 1;
    }
  }
  return false;
}

function findOpeningScript(html, from) {
  for (let index = from; index < html.length; index += 1) {
    if (html[index] !== '<') continue;
    if (html.startsWith('<!--', index)) {
      const commentEnd = html.indexOf('-->', index + 4);
      return commentEnd < 0 ? null : findOpeningScript(html, commentEnd + 3);
    }
    if (html.slice(index + 1, index + 7).toLowerCase() !== 'script') continue;
    if (!hasTagBoundary(html[index + 7])) continue;
    const end = findTagEnd(html, index + 7);
    if (end < 0) throw new Error('Unterminated <script> opening tag.');
    return { end, hasSrc: hasSrcAttribute(html, index + 7, end) };
  }
  return null;
}

function findClosingScript(html, from) {
  for (let index = from; index < html.length; index += 1) {
    if (html[index] !== '<' || html[index + 1] !== '/') continue;
    if (html.slice(index + 2, index + 8).toLowerCase() !== 'script') continue;
    if (!hasTagBoundary(html[index + 8])) continue;
    const end = findTagEnd(html, index + 8);
    if (end < 0) return null;
    return { start: index, end };
  }
  return null;
}

export function extractInlineScripts(html) {
  if (typeof html !== 'string') throw new TypeError('HTML source must be a string.');
  const scripts = [];
  let cursor = 0;
  while (true) {
    const opening = findOpeningScript(html, cursor);
    if (!opening) return scripts;
    const closing = findClosingScript(html, opening.end + 1);
    if (!closing) throw new Error('Unterminated <script> element.');
    if (!opening.hasSrc) {
      const body = html.slice(opening.end + 1, closing.start);
      if (body.trim()) scripts.push(body);
    }
    cursor = closing.end + 1;
  }
}

export function checkInlineScripts(files = ['index.html', 'player.html']) {
  for (const file of files) {
    const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    let count = 0;
    for (const source of extractInlineScripts(html)) {
      new Script(source, { filename: file + ':inline-' + (++count) });
    }
    assert.ok(count > 0, file + ' must contain authored JavaScript');
    console.log(file + ': ' + count + ' inline scripts compile');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  checkInlineScripts();
}
