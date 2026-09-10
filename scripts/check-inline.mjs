import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

// Compile authored inline JavaScript without running browser or emulator code.
for (const file of ['index.html', 'player.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
    new Script(match[2], { filename: file + ':inline-' + (++count) });
  }
  assert.ok(count > 0, file + ' must contain authored JavaScript');
  console.log(file + ': ' + count + ' inline scripts compile');
}
