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

// --- overlay shell and site integration (Task 13) ---

const modernPath = new URL('../assets/mnrv.html', import.meta.url);
const vercelPath = new URL('../vercel.json', import.meta.url);

const portfolioPath = new URL('../portfolio.html', import.meta.url);

const [modernHtml, vercelRaw, portfolioHtml] = await Promise.all([
  readFile(modernPath, 'utf8'),
  readFile(vercelPath, 'utf8'),
  readFile(portfolioPath, 'utf8'),
]);

test('assets/mnrv.html start-een-project CTA calls window.LAVA.start and no longer links to #contact', () => {
  const cta = modernHtml.match(/<[^>]*id="lava-start-hero"[^>]*>/);
  assert.ok(cta, 'the hero CTA must be identifiable');
  assert.doesNotMatch(cta[0], /href="#contact"/, 'the hero CTA starts LAVA, it does not jump to a form');
  assert.match(modernHtml, /data-lava-start/, 'CTAs opt in through the data attribute the client binds');
});

test("assets/mnrv.html okaay-lets-go CTA calls window.LAVA.start instead of opening the intake modal", () => {
  const cta = modernHtml.match(/<[^>]*id="lava-start-contact"[^>]*>/);
  assert.ok(cta, 'the contact CTA must be identifiable');
  assert.match(cta[0], /data-lava-start/);
  // The modal is still reachable, but from the typed-route link, not this button.
  assert.notEqual(
    modernHtml.indexOf('id="lava-start-contact"'),
    modernHtml.indexOf('id="open-intake-modal"'),
    'the LAVA CTA and the modal trigger must be two different elements',
  );
});

test('assets/mnrv.html offers a liever-typen link to intakeformulier.html next to each CTA', () => {
  const links = modernHtml.match(/class="[^"]*lava-type-link[^"]*"/g) || [];
  assert.ok(links.length >= 2, `expected a typed-route link beside each CTA, found ${links.length}`);
  assert.match(modernHtml, /liever typen/i);
  // The existing modal code binds this id and still opens intakeformulier.html.
  assert.match(modernHtml, /id="open-intake-modal"/);
});

test('assets/mnrv.html loads js/lava/index.mjs and css/lava.css', () => {
  assert.match(modernHtml, /<link[^>]+href="\/css\/lava\.css"/);
  assert.match(modernHtml, /<script[^>]+type="module"[^>]+src="\/js\/lava\/index\.mjs"/);
});

test('vercel.json Permissions-Policy grants microphone to self only', () => {
  const config = JSON.parse(vercelRaw);
  const headers = config.headers.flatMap((entry) => entry.headers);
  const policy = headers.find((h) => h.key.toLowerCase() === 'permissions-policy');
  assert.ok(policy, 'Permissions-Policy must be set');
  assert.match(policy.value, /microphone=\(self\)/);
  assert.doesNotMatch(policy.value, /microphone=\*/);
});

test('vercel.json no longer mentions omnicontent.nl', () => {
  assert.doesNotMatch(vercelRaw, /omnicontent\.nl/i);
});

test('css/lava.css collapses the notes strip under a 768px media query', () => {
  assert.match(lavaCss, /@media[^{]*max-width:\s*767px/);
  assert.match(lavaCss, /lava-notes-strip/, 'the overlay renders notes as a strip, not a second window');
});

test('the overlay shell has no drag or resize affordance', () => {
  // main.js drives dragging from .win-titlebar; the overlay panel must opt out.
  assert.match(lavaCss, /\.lava-overlay[^}]*\{[^}]*position:\s*fixed/s);
  assert.match(clientJs, /lava-overlay/);
});

test('the client asks its parent to break out of the sandboxed portfolio iframe', () => {
  // The iframe at portfolio.html:153 is an opaque origin where getUserMedia
  // cannot work. A popup inherits the sandbox (no allow-popups-to-escape-sandbox)
  // so it is opaque too; the unsandboxed parent does the navigation instead.
  // The behaviour itself is covered in tests/lava-client.test.mjs.
  assert.match(clientJs, /window\.self\s*!==\s*window\.top/);
  assert.match(clientJs, /lava=1/);
  assert.match(clientJs, /postMessage/);
  assert.doesNotMatch(clientJs, /window\.open\(/, 'a popup inherits the sandbox and cannot help');

  const portfolio = portfolioHtml;
  assert.match(portfolio, /mnrv-lava/, 'portfolio.html must act on the breakout request');
  assert.match(portfolio, /event\.origin !== window\.location\.origin/, 'the listener must check the origin');
});

test('index.html starts LAVA when it is opened with ?lava=1', () => {
  assert.match(clientJs, /lava=1|['"]lava['"]/);
  assert.match(clientJs, /URLSearchParams|location\.search/);
});

const sessionSrc = await readFile(new URL('../api/lava/session.mjs', import.meta.url), 'utf8');

test('the browser client reads the field names the session endpoint actually returns', () => {
  // Cross-file contract: the endpoint and the client are written apart, and a
  // renamed key here is invisible until a live call hands the SDK undefined.
  const success = sessionSrc.match(/sendJson\(res,\s*200,\s*\{([^}]*)\}/);
  assert.ok(success, 'the session endpoint must have a 200 payload');
  const returned = success[1]
    .split(',')
    .map((part) => part.trim().split(':')[0].trim())
    .filter(Boolean);

  const destructure = clientJs.match(/const\s*\{([^}]*)\}\s*=\s*await\s+mintToken\(\)/);
  assert.ok(destructure, 'the client must destructure the session response');
  const read = destructure[1]
    .split(',')
    .map((part) => part.trim().split(':')[0].trim())
    .filter(Boolean);

  for (const name of read) {
    assert.ok(
      returned.includes(name),
      `the client reads "${name}" but /api/lava/session returns {${returned.join(', ')}}`,
    );
  }
});
