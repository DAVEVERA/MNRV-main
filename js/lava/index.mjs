// LAVA.exe — the browser half of the spoken intake agent.
//
// Mints a short-lived token from /api/lava/session, opens a WebRTC session with
// the ElevenLabs agent, and renders three Win98 windows: the agent itself, the
// live "Wat LAVA begrijpt" notes, and the booked appointment.
//
// Two shells (see shell.mjs):
//   window  — the draggable Win98 windows on the retro desktop at >=768px
//   overlay — one centred panel, notes as a collapsible strip, used on phones
//             and on the modern route at /assets/mnrv.html
// The overlay REUSES the same markup: the panel is moved into the overlay
// container rather than duplicated, so there is one set of ids on every page.
//
// The server tools (availability, book, report) are called by the agent, not
// from here. The browser only registers the two CLIENT tools the agent invokes
// to drive this UI.

import { createNotesModel } from './notes.mjs';
import { barsFromFrequencies } from './meter.mjs';
import { pickShell } from './shell.mjs';

// Pinned exactly: a floating tag would change the running code without a deploy.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.37.1/+esm';

const BAR_COUNT = 12;
const SESSION_ENDPOINT = '/api/lava/session';
// Opened in a new tab when LAVA is started from inside the sandboxed iframe.
const BREAKOUT_URL = '/index.html?lava=1';

// Cloudflare Turnstile. The site key is public by design and is read from a
// meta tag so this static site needs no build step; the owner fills it in.
// Without it /api/lava/session answers 403 bot_check_failed for everyone.
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const TEXT = {
  full: 'LAVA zit vandaag vol. Vul het formulier in of mail ons.',
  unavailable: 'LAVA is even niet bereikbaar. Probeer het later nog eens.',
  blocked: 'We konden niet vaststellen dat je een mens bent. Ververs de pagina en probeer opnieuw.',
  noMic: 'Geen toegang tot de microfoon. Geef toestemming en probeer opnieuw.',
  connecting: 'Verbinden...',
  connected: 'Verbonden',
  ended: 'Gesprek beëindigd',
  paused: 'Gepauzeerd',
  notesEmpty: 'Nog niets genoteerd.',
  correction: 'Dat klopt niet.',
  readyToStart: 'Klaar om te beginnen. Druk op Start gesprek.',
  notConfigured: 'LAVA is nog niet ingeschakeld op deze site. Vul het formulier in of mail ons.',
};

const $ = (id) => document.getElementById(id);

function turnstileSiteKey() {
  return (
    window.LAVA_TURNSTILE_SITE_KEY ||
    document.querySelector('meta[name="turnstile-site-key"]')?.getAttribute('content') ||
    ''
  );
}

let turnstileScript;
function loadTurnstile() {
  if (!turnstileScript) {
    turnstileScript = new Promise((resolve, reject) => {
      if (window.turnstile) return resolve(window.turnstile);
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error('Turnstile script could not be loaded'));
      document.head?.appendChild(script) ?? document.body.appendChild(script);
    });
  }
  return turnstileScript;
}

/**
 * One fresh token per attempt. Turnstile tokens are single-use and expire in
 * about five minutes, so a token minted at page load would refuse the
 * visitor's second conversation.
 */
async function getTurnstileToken() {
  const sitekey = turnstileSiteKey();
  if (!sitekey) {
    // Nothing to send. The endpoint will refuse, and the status line says so,
    // rather than the visitor meeting a silent failure.
    throw new Error('no Turnstile site key configured');
  }
  const turnstile = await loadTurnstile();
  let host = $('lava-turnstile');
  if (!host) {
    host = document.createElement('div');
    host.id = 'lava-turnstile';
    host.className = 'lava-turnstile';
    document.body.appendChild(host);
  }
  return new Promise((resolve, reject) => {
    try {
      turnstile.render(host, {
        sitekey,
        size: 'invisible',
        callback: (token) => resolve(token),
        'error-callback': () => reject(new Error('Turnstile refused the visitor')),
        'timeout-callback': () => reject(new Error('Turnstile timed out')),
      });
      turnstile.execute?.(host);
    } catch (err) {
      reject(err);
    }
  });
}

// Swapped by tests; the real one talks to Cloudflare.
let turnstileTokenImpl = getTurnstileToken;

/**
 * assets/mnrv.html is also served inside the sandboxed iframe at
 * portfolio.html:153. That sandbox has no allow-same-origin, so the document is
 * an opaque origin and getUserMedia can never succeed there.
 *
 * A popup does NOT help: without allow-popups-to-escape-sandbox the new context
 * inherits the whole sandbox flag set, so it is opaque too and /api/lava/session
 * becomes a cross-origin request with Origin: null. The parent page is the one
 * that can navigate, so we ask it, using the same bridge pattern the retro
 * browser already uses.
 */
function inSandboxedFrame() {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent throws on access, which is itself the answer.
    return true;
  }
}

function showWindow(id) {
  if (window.MNRV && typeof window.MNRV.showWindow === 'function') {
    window.MNRV.showWindow(id);
    return;
  }
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function hideWindow(id) {
  if (window.MNRV && typeof window.MNRV.hideWindow === 'function') {
    window.MNRV.hideWindow(id);
    return;
  }
  const el = $(id);
  if (el) el.classList.add('hidden');
}

// --- markup ---------------------------------------------------

// The retro desktop ships these windows in index.html. Every other page gets
// them injected, so the ids and the client stay identical across shells.
const PANEL_HTML = `
  <div id="lava-window" class="win-window hidden lava-window">
    <div class="win-titlebar">
      <span class="win-titlebar-title">LAVA.exe</span>
      <div class="win-titlebar-buttons">
        <button type="button" class="win-titlebar-btn close-btn" id="lava-overlay-close" aria-label="Sluiten" title="Sluiten">X</button>
      </div>
    </div>
    <div class="win-body lava-window-body">
      <div id="lava-orb" class="lava-orb" data-state="idle" aria-hidden="true"></div>
      <div id="lava-meter" class="lava-meter" role="presentation" aria-hidden="true"></div>
      <p id="lava-line" class="lava-line" aria-live="polite"></p>
      <p id="lava-status" class="lava-status" role="status">Gereed</p>
      <div class="lava-actions">
        <button type="button" id="lava-start" class="win-btn">Start gesprek</button>
        <button type="button" id="lava-pause" class="win-btn">Pauzeer</button>
        <button type="button" id="lava-end" class="win-btn">Beëindig gesprek</button>
      </div>
    </div>
  </div>
  <div id="lava-notes-window" class="win-window hidden lava-notes-window">
    <div class="win-titlebar">
      <span class="win-titlebar-title">Wat LAVA begrijpt</span>
      <div class="win-titlebar-buttons">
        <button type="button" class="win-titlebar-btn close-btn" aria-label="Sluiten" title="Sluiten">X</button>
      </div>
    </div>
    <div class="win-body lava-notes-body">
      <h3 class="lava-notes-heading">Wat LAVA begrijpt</h3>
      <p id="lava-notes-understood" class="lava-notes-text lava-notes-empty" aria-live="polite">Nog niets genoteerd.</p>
      <h3 class="lava-notes-heading">Open vragen</h3>
      <p id="lava-notes-open" class="lava-notes-text lava-notes-empty" aria-live="polite">Nog niets genoteerd.</p>
      <div class="lava-actions">
        <button type="button" id="lava-notes-wrong" class="win-btn">Dit klopt niet</button>
      </div>
    </div>
  </div>
  <div id="lava-appointment-window" class="win-window hidden lava-appointment-window">
    <div class="win-titlebar">
      <span class="win-titlebar-title">Afspraak</span>
      <div class="win-titlebar-buttons">
        <button type="button" class="win-titlebar-btn close-btn" aria-label="Sluiten" title="Sluiten">X</button>
      </div>
    </div>
    <div class="win-body lava-appointment-body">
      <p id="lava-appointment-label" class="lava-appointment-label"></p>
      <div class="lava-actions">
        <button type="button" id="lava-appointment-download" class="win-btn">Uitnodiging ophalen</button>
      </div>
    </div>
  </div>
`;

function ensureMarkup() {
  if (!$('lava-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'lava-overlay';
    overlay.className = 'lava-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'LAVA');
    overlay.innerHTML = '<div class="lava-overlay-panel"></div>';
    document.body.appendChild(overlay);
  }
  if (!$('lava-window')) {
    const host = document.createElement('div');
    host.innerHTML = PANEL_HTML;
    while (host.firstElementChild) document.body.appendChild(host.firstElementChild);
  }
}

// --- notes ----------------------------------------------------

const notes = createNotesModel();

function renderNotes() {
  const view = notes.render();
  const understood = $('lava-notes-understood');
  const open = $('lava-notes-open');
  if (understood) {
    understood.textContent = view.understood || TEXT.notesEmpty;
    understood.classList.toggle('lava-notes-empty', !view.understood);
  }
  if (open) {
    open.textContent = view.open || TEXT.notesEmpty;
    open.classList.toggle('lava-notes-empty', !view.open);
  }
  if (!view.hasContent) return;
  if (currentShell() === 'overlay') {
    // In the overlay there is no second floating window: the notes sit as a
    // strip under the panel.
    $('lava-notes-window')?.classList.remove('hidden');
  } else {
    showWindow('lava-notes-window');
  }
}

// --- meter ----------------------------------------------------

function renderMeter(bars) {
  const container = $('lava-meter');
  if (!container) return;
  const nodes = container.children;
  for (let i = 0; i < nodes.length; i += 1) {
    const value = bars[i] || 0;
    nodes[i].style.height = `${Math.max(2, Math.round(value * 100))}%`;
  }
}

function buildMeter() {
  const meter = $('lava-meter');
  if (!meter || meter.children.length > 0) return;
  for (let i = 0; i < BAR_COUNT; i += 1) {
    const bar = document.createElement('span');
    bar.className = 'lava-meter-bar';
    meter.appendChild(bar);
  }
}

// --- the session ----------------------------------------------

const state = {
  conversation: null,
  frame: null,
  starting: false,
  paused: false,
  // Counts how often a session was actually attempted, so a test can prove
  // nothing starts without a click.
  startAttempts: 0,
};

const currentShell = () => pickShell(window.innerWidth, window.location.pathname);

function setStatus(text) {
  const el = $('lava-status');
  if (el) el.textContent = text;
}

function setLine(text) {
  const el = $('lava-line');
  if (el) el.textContent = text;
}

function setOrb(mode) {
  const orb = $('lava-orb');
  if (orb) orb.dataset.state = mode;
}

function stopMeter() {
  if (state.frame !== null) {
    cancelAnimationFrame(state.frame);
    state.frame = null;
  }
  renderMeter(new Array(BAR_COUNT).fill(0));
}

function startMeter(conversation) {
  const tick = () => {
    let data;
    try {
      data = conversation.getOutputByteFrequencyData?.();
    } catch {
      data = undefined;
    }
    renderMeter(barsFromFrequencies(data, BAR_COUNT));
    state.frame = requestAnimationFrame(tick);
  };
  state.frame = requestAnimationFrame(tick);
}

/** Turns a session response into the Dutch line the visitor sees. */
function messageForStatus(status) {
  if (status === 429) return TEXT.full;
  if (status === 403) return TEXT.blocked;
  if (status === 502 || status === 503) return TEXT.unavailable;
  return TEXT.unavailable;
}

async function mintToken() {
  const turnstileToken = await turnstileTokenImpl();
  const res = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ turnstileToken }),
  });
  if (!res.ok) {
    const err = new Error(`session endpoint returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// --- client tools the agent calls -----------------------------

function update_notes({ understood, open } = {}) {
  notes.apply({ understood, open });
  renderNotes();
  return 'ok';
}

function show_appointment({ label, icsText } = {}) {
  const labelEl = $('lava-appointment-label');
  if (labelEl) labelEl.textContent = label || '';
  const button = $('lava-appointment-download');
  if (button) {
    button.onclick = () => {
      if (!icsText) return;
      const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lava-afspraak.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  const appointmentWindow = $('lava-appointment-window');
  if (currentShell() === 'overlay') {
    // The overlay is fixed at z-index 100000; a window left in the body flow is
    // invisible underneath it, and on the modern route it is unstyled too.
    const panel = $('lava-overlay')?.querySelector('.lava-overlay-panel');
    if (panel && appointmentWindow && appointmentWindow.parentElement !== panel) {
      panel.appendChild(appointmentWindow);
    }
    appointmentWindow?.classList.remove('hidden');
  } else {
    showWindow('lava-appointment-window');
  }
  return 'ok';
}

// --- shells ---------------------------------------------------

function openShell() {
  ensureMarkup();
  buildMeter();
  const overlay = $('lava-overlay');
  const panel = overlay?.querySelector('.lava-overlay-panel');
  const win = $('lava-window');
  const notesWin = $('lava-notes-window');

  if (currentShell() === 'overlay') {
    if (panel && win && win.parentElement !== panel) {
      panel.appendChild(win);
      if (notesWin) {
        notesWin.classList.add('lava-notes-strip');
        panel.appendChild(notesWin);
      }
    }
    overlay?.classList.add('is-open');
    win?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    return;
  }

  // Retro desktop: hand the window back to main.js.
  if (win && overlay && overlay.contains(win)) {
    document.body.appendChild(win);
    if (notesWin) {
      notesWin.classList.remove('lava-notes-strip');
      document.body.appendChild(notesWin);
    }
  }
  overlay?.classList.remove('is-open');
  document.body.style.overflow = '';
  showWindow('lava-window');
}

function closeShell() {
  const overlay = $('lava-overlay');
  overlay?.classList.remove('is-open');
  document.body.style.overflow = '';
  for (const id of ['lava-window', 'lava-notes-window', 'lava-appointment-window']) {
    hideWindow(id);
    $(id)?.classList.add('hidden');
  }
}

// --- lifecycle ------------------------------------------------

async function start() {
  // Inside the sandboxed portfolio iframe the microphone can never be granted,
  // so open the real desktop in a tab and let it start LAVA there.
  if (inSandboxedFrame()) {
    try {
      window.parent.postMessage({ source: 'mnrv-lava', action: 'open', url: BREAKOUT_URL }, '*');
    } catch (err) {
      console.error('LAVA could not ask the parent page to open:', err);
    }
    return;
  }
  if (state.conversation || state.starting) return;
  state.starting = true;
  state.startAttempts += 1;
  openShell();
  setStatus(TEXT.connecting);
  setOrb('idle');

  try {
    // /api/lava/session answers { token, agentId }; the SDK wants the token
    // under conversationToken.
    const { token } = await mintToken();
    const { Conversation } = await import(SDK_URL);
    state.conversation = await Conversation.startSession({
      conversationToken: token,
      connectionType: 'webrtc',
      clientTools: { update_notes, show_appointment },
      onConnect: () => {
        setStatus(TEXT.connected);
        setOrb('listening');
      },
      onDisconnect: () => {
        setStatus(TEXT.ended);
        setOrb('idle');
        stopMeter();
        state.conversation = null;
      },
      onModeChange: ({ mode }) => setOrb(mode === 'speaking' ? 'speaking' : 'listening'),
      onMessage: ({ message, source }) => {
        if (source === 'ai' && message) setLine(message);
      },
      onError: (err) => {
        console.error('LAVA session error:', err);
        setStatus(TEXT.unavailable);
      },
    });
    startMeter(state.conversation);
  } catch (err) {
    console.error('LAVA could not start:', err);
    if (err && /Turnstile site key/.test(err.message || '')) setStatus(TEXT.notConfigured);
    else if (err && err.status) setStatus(messageForStatus(err.status));
    else if (err && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')) setStatus(TEXT.noMic);
    else setStatus(TEXT.unavailable);
    setOrb('idle');
  } finally {
    state.starting = false;
  }
}

async function stop() {
  stopMeter();
  const conversation = state.conversation;
  state.conversation = null;
  state.paused = false;
  if (conversation) {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error('LAVA could not end the session cleanly:', err);
    }
  }
  setStatus(TEXT.ended);
  setOrb('idle');
  closeShell();
}

function togglePause() {
  const conversation = state.conversation;
  if (!conversation) return;
  state.paused = !state.paused;
  try {
    conversation.setMicMuted?.(state.paused);
  } catch (err) {
    console.error('LAVA could not toggle the microphone:', err);
  }
  setStatus(state.paused ? TEXT.paused : TEXT.connected);
}

function sendCorrection() {
  const conversation = state.conversation;
  if (!conversation) return;
  try {
    // LAVA hears the correction and answers; the page never edits its own notes.
    conversation.sendUserMessage?.(TEXT.correction);
  } catch (err) {
    console.error('LAVA could not send the correction:', err);
  }
}

// --- wiring ---------------------------------------------------

function wire() {
  ensureMarkup();
  buildMeter();

  $('lava-start')?.addEventListener('click', start);
  $('lava-pause')?.addEventListener('click', togglePause);
  $('lava-end')?.addEventListener('click', stop);
  $('lava-notes-wrong')?.addEventListener('click', sendCorrection);
  // index.html ships its own close buttons (class only, no id) and main.js
  // would merely hide the window, leaving the call and the microphone live.
  // Bind by structure so every shell hangs up properly.
  for (const id of ['lava-window', 'lava-notes-window']) {
    $(id)?.querySelector('.close-btn')?.addEventListener('click', (event) => {
      event.preventDefault?.();
      stop();
    });
  }
  $('lava-overlay-close')?.addEventListener('click', stop);
  renderNotes();

  // Every CTA that should start LAVA carries data-lava-start.
  document.querySelectorAll('[data-lava-start]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      start();
    });
  });

  // The breakout tab lands here; open LAVA straight away. The microphone is
  // still only requested by the SDK after this user-initiated navigation.
  let wantsLava = false;
  try {
    wantsLava = new URLSearchParams(window.location.search).get('lava') === '1';
  } catch {
    wantsLava = false;
  }
  if (wantsLava) {
    // Open the window and wait. Auto-starting would mint a token and call
    // getUserMedia with no gesture on THIS document: user activation does not
    // carry across a navigation, so the microphone would open uninvited and
    // autoplay policy would keep LAVA's own audio suspended anyway.
    openShell();
    setStatus(TEXT.readyToStart);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire, { once: true });
} else {
  wire();
}

window.LAVA = { start, stop };

// --- seams for tests -----------------------------------------
// The wiring above is where this module's real defects have lived, so
// tests/lava-client.test.mjs drives it against a fake DOM.
export function __setConversationForTest(conversation) {
  state.conversation = conversation;
}
export function __openShellForTest() {
  openShell();
}
export function __startedForTest() {
  return state.startAttempts;
}
export function __setTurnstileForTest(fn) {
  turnstileTokenImpl = fn;
}

export { start, stop, update_notes, show_appointment };
