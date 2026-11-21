// --- notes.mjs and shell.mjs (Task 11) ---
// Both modules are pure: no DOM, no network, so the browser entry and these
// tests import exactly the same code.

import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotesModel } from '../js/lava/notes.mjs';
import { pickShell } from '../js/lava/shell.mjs';

test('notes model starts with hasContent false', () => {
  const notes = createNotesModel();
  const view = notes.render();
  assert.equal(view.hasContent, false);
  assert.equal(view.understood, '');
  assert.equal(view.open, '');
});

test('notes model replaces the understood text on a second apply', () => {
  const notes = createNotesModel();
  notes.apply({ understood: 'Planning kost handwerk.' });
  notes.apply({ understood: 'Planning en urenregistratie staan los van elkaar.' });
  // LAVA rewrites his understanding; he does not append to it.
  assert.equal(notes.render().understood, 'Planning en urenregistratie staan los van elkaar.');
});

test('notes model keeps the previous open text when an update omits it', () => {
  const notes = createNotesModel();
  notes.apply({ understood: 'Eerste beeld.', open: 'Welk systeem gebruiken ze nu?' });
  notes.apply({ understood: 'Scherper beeld.' });
  const view = notes.render();
  assert.equal(view.understood, 'Scherper beeld.');
  assert.equal(view.open, 'Welk systeem gebruiken ze nu?');
  assert.equal(view.hasContent, true);
});

test('notes model ignores a non-string or empty field rather than blanking the panel', () => {
  const notes = createNotesModel();
  notes.apply({ understood: 'Blijft staan.', open: 'Open vraag.' });
  notes.apply({ understood: '   ', open: 42 });
  const view = notes.render();
  assert.equal(view.understood, 'Blijft staan.');
  assert.equal(view.open, 'Open vraag.');
});

test('notes model ignores an absent or malformed update', () => {
  const notes = createNotesModel();
  notes.apply({ understood: 'Staat er.' });
  notes.apply(undefined);
  notes.apply(null);
  notes.apply('nonsense');
  assert.equal(notes.render().understood, 'Staat er.');
});

test('notes model renders trimmed text', () => {
  const notes = createNotesModel();
  notes.apply({ understood: '  met spaties  ' });
  assert.equal(notes.render().understood, 'met spaties');
});

test('pickShell returns overlay at 360 width on the desktop path', () => {
  assert.equal(pickShell(360, '/'), 'overlay');
});

test('pickShell returns overlay on /assets/mnrv.html at 1440 width', () => {
  assert.equal(pickShell(1440, '/assets/mnrv.html'), 'overlay');
});

test('pickShell returns window on / at 1440 width', () => {
  assert.equal(pickShell(1440, '/'), 'window');
});

test('pickShell returns window on /index.html at 1440 width', () => {
  assert.equal(pickShell(1440, '/index.html'), 'window');
});

test('pickShell treats exactly 768 as the first window width', () => {
  // The spec's boundary: below 768 is overlay, 768 and up is the Win98 window.
  assert.equal(pickShell(767, '/'), 'overlay');
  assert.equal(pickShell(768, '/'), 'window');
});

test('pickShell falls back to overlay for an unusable width', () => {
  assert.equal(pickShell(undefined, '/'), 'overlay');
  assert.equal(pickShell(Number.NaN, '/'), 'overlay');
});
