// --- js/lava/index.mjs, exercised against a real-ish DOM ---
//
// The static assertions in lava-integration.test.mjs check that strings exist
// in the source. These check what the client DOES: which element hangs up the
// call, where the appointment window ends up, and whether anything can open a
// microphone without a click.

import assert from 'node:assert/strict';
import test from 'node:test';

import { installFakeDom } from './helpers/fake-dom.mjs';

/** Loads a fresh copy of the client against a fresh DOM. */
async function loadClient(opts = {}) {
  const dom = installFakeDom(opts);
  // A query string busts the module cache so each test gets its own state.
  const mod = await import(`../js/lava/index.mjs?t=${Math.random()}`);
  return { ...dom, mod };
}

test('the Win98 close button ends the session instead of only hiding the window', async () => {
  // I5: #lava-overlay-close exists only in the injected markup, so on the retro
  // desktop the X fell through to main.js, which hides the window. The call —
  // and the microphone — stayed live behind a window that was gone.
  const { doc, mod, restore } = await loadClient();
  try {
    let ended = 0;
    mod.__setConversationForTest({
      endSession: async () => {
        ended += 1;
      },
    });
    const close = doc.getElementById('lava-window').querySelector('.close-btn');
    assert.ok(close, 'the shipped window has a close button');
    close.click();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(ended, 1, 'closing the window must end the conversation');
  } finally {
    restore();
  }
});

test('closing from the overlay also clears the backdrop and unlocks the page', async () => {
  // I5 scenario B: on a phone the X hid the panel but left a fixed, opaque,
  // scroll-locking overlay with nothing left to dismiss it.
  const { doc, mod, restore } = await loadClient({ width: 390 });
  try {
    mod.__setConversationForTest({ endSession: async () => {} });
    mod.__openShellForTest();
    assert.ok(doc.getElementById('lava-overlay').classList.contains('is-open'));

    doc.getElementById('lava-window').querySelector('.close-btn').click();
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(doc.getElementById('lava-overlay').classList.contains('is-open'), false);
    assert.notEqual(doc.body.style.overflow, 'hidden', 'the page must scroll again');
  } finally {
    restore();
  }
});

test('show_appointment puts the invitation inside the overlay, not behind it', async () => {
  // I6: the overlay is fixed with z-index 100000; a window left in the body
  // flow is invisible under it, so the visitor never sees "Uitnodiging ophalen".
  const { doc, mod, restore } = await loadClient({ width: 1440, pathname: '/assets/mnrv.html' });
  try {
    mod.__openShellForTest();
    mod.show_appointment({ label: 'dinsdag 20 oktober om 10:00', icsText: 'BEGIN:VCALENDAR' });

    const panel = doc.getElementById('lava-overlay').querySelector('.lava-overlay-panel');
    const appt = doc.getElementById('lava-appointment-window');
    assert.ok(panel.contains(appt), 'the appointment window must live inside the overlay panel');
    assert.equal(appt.classList.contains('hidden'), false);
    assert.equal(doc.getElementById('lava-appointment-label').textContent, 'dinsdag 20 oktober om 10:00');
  } finally {
    restore();
  }
});

test('show_appointment leaves the window on the desktop where main.js manages it', async () => {
  const { doc, mod, restore } = await loadClient({ width: 1440, pathname: '/' });
  try {
    mod.__openShellForTest();
    mod.show_appointment({ label: 'x', icsText: 'BEGIN:VCALENDAR' });
    const panel = doc.getElementById('lava-overlay').querySelector('.lava-overlay-panel');
    assert.equal(panel.contains(doc.getElementById('lava-appointment-window')), false);
  } finally {
    restore();
  }
});

test('?lava=1 opens the window but does not start a conversation on its own', async () => {
  // I7: auto-starting mints a token and calls getUserMedia with no gesture on
  // that document. A shared link would open a live microphone, and autoplay
  // policy would keep LAVA inaudible anyway.
  const { doc, mod, restore } = await loadClient({ search: '?lava=1' });
  try {
    assert.equal(mod.__startedForTest(), 0, 'no session may be minted without a click');
    assert.equal(
      doc.getElementById('lava-window').classList.contains('hidden'),
      false,
      'the window should still be waiting, ready for the visitor to press start',
    );
  } finally {
    restore();
  }
});

test('a normal load neither opens the window nor starts anything', async () => {
  const { doc, mod, restore } = await loadClient();
  try {
    assert.equal(mod.__startedForTest(), 0);
    assert.equal(doc.getElementById('lava-window').classList.contains('hidden'), true);
  } finally {
    restore();
  }
});

test('inside the sandboxed portfolio iframe the client asks the parent to break out', async () => {
  // I8: window.open from a sandbox without allow-popups-to-escape-sandbox
  // inherits the sandbox, so the new tab is still an opaque origin where
  // getUserMedia cannot be granted and /api/lava/session is cross-origin.
  const { win, mod, restore } = await loadClient({ pathname: '/assets/mnrv.html', inFrame: true });
  try {
    await mod.start();
    assert.equal(win.opened.length, 0, 'a popup inherits the sandbox and cannot help');
    assert.equal(win.posted.length, 1, 'the parent page is the one that can navigate');
    const [message] = win.posted[0];
    assert.equal(message.source, 'mnrv-lava');
    assert.equal(message.action, 'open');
    assert.equal(mod.__startedForTest(), 0, 'no token is minted from inside the frame');
  } finally {
    restore();
  }
});

test('start fetches a fresh Turnstile token rather than a stale page-load one', async () => {
  // C1: nothing ever set window.LAVA_TURNSTILE_TOKEN, so every visitor was
  // refused with 403 bot_check_failed. Turnstile tokens are also single-use and
  // short-lived, so a token minted at page load would fail the second
  // conversation even once the widget exists.
  const { mod, restore } = await loadClient();
  try {
    let asked = 0;
    mod.__setTurnstileForTest(async () => {
      asked += 1;
      return `cf-token-${asked}`;
    });
    const sent = [];
    globalThis.fetch = async (url, init) => {
      sent.push(JSON.parse(init.body));
      return { ok: false, status: 503, json: async () => ({}) };
    };
    await mod.start();
    await mod.start();
    assert.equal(asked, 2, 'each attempt needs its own token');
    assert.deepEqual(sent.map((b) => b.turnstileToken), ['cf-token-1', 'cf-token-2']);
  } finally {
    delete globalThis.fetch;
    restore();
  }
});
