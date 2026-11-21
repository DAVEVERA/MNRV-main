// --- LAVA.exe in the retro desktop (Task 12) ---
// Static assertions over the shipped HTML and CSS, in the style of
// tests/reported-diagnostics.test.mjs. No DOM, no browser.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexPath = new URL('../index.html', import.meta.url);
const lavaCssPath = new URL('../css/lava.css', import.meta.url);
const stylePath = new URL('../css/style.css', import.meta.url);
const clientPath = new URL('../js/lava/index.mjs', import.meta.url);

const [indexHtml, lavaCss, styleCss, clientJs] = await Promise.all([
  readFile(indexPath, 'utf8'),
  readFile(lavaCssPath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(clientPath, 'utf8'),
]);

/** The markup of one element by id, up to a generous bound. */
function blockFor(html, id) {
  const start = html.indexOf(`id="${id}"`);
  assert.notEqual(start, -1, `#${id} is missing from index.html`);
  const from = html.lastIndexOf('<div', start);
  return html.slice(from, from + 4000);
}

test('index.html no longer references omnicontent.nl', () => {
  assert.doesNotMatch(indexHtml, /omnicontent\.nl/i);
});

test('index.html has no iframe inside #lava-window', () => {
  const block = blockFor(indexHtml, 'lava-window');
  const upToNext = block.slice(0, block.indexOf('id="lava-notes-window"') + 1 || block.length);
  assert.doesNotMatch(upToNext, /<iframe/i, 'LAVA.exe is the agent itself, not an embedded page');
});

test('index.html keeps the My LAVA desktop icon pointing at data-window="lava-window"', () => {
  assert.match(indexHtml, /data-window="lava-window"/);
});

test('index.html contains a #lava-notes-window with win-titlebar and win-body', () => {
  const block = blockFor(indexHtml, 'lava-notes-window');
  assert.match(block, /win-titlebar/, 'the notes window reuses the Win98 chrome');
  assert.match(block, /win-body/);
  assert.match(block, /Wat LAVA begrijpt/);
  assert.match(block, /Dit klopt niet/);
});

test('index.html contains a #lava-appointment-window with an Uitnodiging ophalen button', () => {
  const block = blockFor(indexHtml, 'lava-appointment-window');
  assert.match(block, /win-titlebar/);
  assert.match(block, /Uitnodiging ophalen/);
});

test('index.html loads js/lava/index.mjs as type="module"', () => {
  assert.match(indexHtml, /<script[^>]+type="module"[^>]+src="js\/lava\/index\.mjs"|<script[^>]+src="js\/lava\/index\.mjs"[^>]+type="module"/);
});

test('index.html loads css/lava.css', () => {
  assert.match(indexHtml, /<link[^>]+href="css\/lava\.css"/);
});

test('the three LAVA windows carry the win-window chrome so main.js can drive them', () => {
  for (const id of ['lava-window', 'lava-notes-window', 'lava-appointment-window']) {
    const block = blockFor(indexHtml, id);
    assert.match(block, /class="[^"]*win-window[^"]*"/, `#${id} must be a win-window`);
    assert.match(block, /class="[^"]*hidden[^"]*"/, `#${id} must start hidden`);
    assert.match(block, /close-btn/, `#${id} needs the Win98 close button`);
  }
});

test('the LAVA window body is Dutch and carries the documented controls', () => {
  const block = blockFor(indexHtml, 'lava-window');
  for (const label of ['Pauzeer', 'Beëindig gesprek']) {
    assert.match(block, new RegExp(label), `the window is missing the control: ${label}`);
  }
});

test('css/lava.css defines no colour outside the Win98 palette already used in css/style.css', () => {
  const hexes = (css) =>
    (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((h) => h.toLowerCase()).map((h) =>
      // expand #abc to #aabbcc so the two sets compare
      h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h,
    );
  const allowed = new Set(hexes(styleCss));
  const used = new Set(hexes(lavaCss));
  const strangers = [...used].filter((h) => !allowed.has(h));
  assert.deepEqual(strangers, [], `lava.css introduces colours the site does not use: ${strangers}`);
});

test('the browser client pins an exact ElevenLabs SDK version', () => {
  const url = clientJs.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/@elevenlabs\/client@([^/'"]+)/);
  assert.ok(url, 'the SDK must come from a pinned jsDelivr ESM URL');
  assert.match(url[1], /^\d+\.\d+\.\d+$/, 'the version must be exact, never a tag or a range');
});

test('the browser client registers both documented client tools', () => {
  assert.match(clientJs, /update_notes/);
  assert.match(clientJs, /show_appointment/);
});

test('the browser client handles every status the session endpoint can return', () => {
  // Task 6 ledger: the endpoint answers 403, 429, 502 and 503.
  for (const status of ['403', '429', '502', '503']) {
    assert.match(clientJs, new RegExp(status), `the client ignores session status ${status}`);
  }
  assert.match(clientJs, /LAVA zit vandaag vol/, 'the ceiling message must be the documented Dutch line');
});

test('the browser client exposes window.LAVA for the modern-route CTAs', () => {
  assert.match(clientJs, /window\.LAVA\s*=/);
  assert.match(clientJs, /\bstart\b/);
  assert.match(clientJs, /\bstop\b/);
});

test('the correction button sends a message to LAVA rather than editing the notes locally', () => {
  assert.match(clientJs, /sendUserMessage/);
  assert.match(clientJs, /Dat klopt niet\./);
});
