import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexPath = new URL('../index.html', import.meta.url);
const modernPath = new URL('../assets/mnrv.html', import.meta.url);
const vercelPath = new URL('../vercel.json', import.meta.url);

const [indexHtml, modernHtml, vercelConfig] = await Promise.all([
  readFile(indexPath, 'utf8'),
  readFile(modernPath, 'utf8'),
  readFile(vercelPath, 'utf8'),
]);

test('retro desktop and modern route remain available', () => {
  assert.match(indexHtml, /<div class="desktop booting">/);
  assert.match(indexHtml, /data-target="assets\/mnrv\.html"/);
  assert.match(indexHtml, /<span class="icon-label">Moderne route<\/span>/);
  assert.match(modernHtml, /<!DOCTYPE html>/i);
});

test('retro browser uses a sandboxed postMessage bridge', () => {
  const frame = indexHtml.match(/<iframe\s+id="retro-browser-frame"[\s\S]*?<\/iframe>/i)?.[0];

  assert.ok(frame, 'retro browser iframe is present');
  assert.match(frame, /sandbox="allow-scripts"/);
  assert.doesNotMatch(frame, /allow-same-origin/);
  assert.match(indexHtml, /parent\.postMessage\(/);
  assert.match(indexHtml, /event\.source !== frame\.contentWindow/);
  assert.doesNotMatch(indexHtml, /parent\.MNRVRetroBrowser/);
});

test('reported iframe and Clippy diagnostics stay removed', () => {
  assert.doesNotMatch(indexHtml, /agent\.mute\s*\(/);
  assert.doesNotMatch(indexHtml, /omnicontent\.nl/i);
  assert.doesNotMatch(vercelConfig, /omnicontent\.nl/i);
  assert.match(indexHtml, /class="win-btn lava-modern-link" href="assets\/mnrv\.html#contact"/);

  const intakeFrame = modernHtml.match(/<iframe\s+id="intake-frame"[^>]*>/i)?.[0];
  assert.ok(intakeFrame, 'modern intake iframe is present');
  assert.doesNotMatch(intakeFrame, /\ssandbox=/i);
});
