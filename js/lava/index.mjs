// LAVA.exe — the browser half of the spoken intake agent.
//
// Mints a short-lived token from /api/lava/session, opens a WebRTC session with
// the ElevenLabs agent, and renders three Win98 windows: the agent itself, the
// live "Wat LAVA begrijpt" notes, and the booked appointment.
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
};

const $ = (id) => document.getElementById(id);

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
  if (view.hasContent) showWindow('lava-notes-window');
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

// --- the session ----------------------------------------------

const state = {
  conversation: null,
  frame: null,
  starting: false,
  paused: false,
};

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
  const turnstileToken = window.LAVA_TURNSTILE_TOKEN || undefined;
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
      // Give the download a tick before the URL is revoked.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  showWindow('lava-appointment-window');
  return 'ok';
}

// --- lifecycle ------------------------------------------------

function openShell() {
  const shell = pickShell(window.innerWidth, window.location.pathname);
  if (shell === 'overlay') {
    const overlay = $('lava-overlay');
    if (overlay) overlay.classList.add('is-open');
  }
  showWindow('lava-window');
}

function closeShell() {
  const overlay = $('lava-overlay');
  if (overlay) overlay.classList.remove('is-open');
  hideWindow('lava-window');
  hideWindow('lava-notes-window');
}

async function start() {
  if (state.conversation || state.starting) return;
  state.starting = true;
  openShell();
  setStatus(TEXT.connecting);
  setOrb('idle');

  try {
    const { conversationToken } = await mintToken();
    const { Conversation } = await import(SDK_URL);
    state.conversation = await Conversation.startSession({
      conversationToken,
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
    if (err && err.status) setStatus(messageForStatus(err.status));
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
    // The SDK mutes the microphone; LAVA keeps the session open.
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
  const meter = $('lava-meter');
  if (meter && meter.children.length === 0) {
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const bar = document.createElement('span');
      bar.className = 'lava-meter-bar';
      meter.appendChild(bar);
    }
  }
  $('lava-start')?.addEventListener('click', start);
  $('lava-pause')?.addEventListener('click', togglePause);
  $('lava-end')?.addEventListener('click', stop);
  $('lava-notes-wrong')?.addEventListener('click', sendCorrection);
  $('lava-overlay-close')?.addEventListener('click', stop);
  renderNotes();

  // The My LAVA desktop icon opens the window through main.js; starting the
  // conversation stays an explicit click so the microphone is never grabbed
  // by merely opening a window.
  document.querySelectorAll('[data-lava-start]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      start();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire, { once: true });
} else {
  wire();
}

window.LAVA = { start, stop };

export { start, stop, update_notes, show_appointment };
