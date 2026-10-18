import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENDINGS,
  LEAD_LABELS,
  normalizeReport,
  renderReportHtml,
  renderReportText,
} from '../api/lava/_lib/report.mjs';

const ABSENT = 'Niet aan de orde gekomen';

const required = {
  naam: 'Mark de Wit',
  email: 'mark@example.nl',
  uitdaging: 'Onze webshop is te traag op mobiel.',
  label: 'binnen_de_lijnen',
  ending: 'appointment',
};

const full = {
  ...required,
  telefoon: '0612345678',
  beoogde_oplossing: 'Een snellere shop met betere productpagina\'s.',
  verwachting: 'Live binnen twee maanden.',
  gespreksdoel: 'Kennismaken en scope bepalen.',
  uitkomst: 'Afspraak gepland op dinsdag 10:00.',
  follow_up: 'Mark stuurt de huidige shop-URL.',
  vervolgactie: { wat: 'Offerte voorbereiden', door: 'Dave' },
  transcript: 'LAVA: Hoi!\nMark: Hallo, ik heb een vraag.\n  Tweede regel met inspringing.',
};

const okReport = (input) => {
  const result = normalizeReport(input);
  assert.equal(result.ok, true);
  return result.report;
};

test('LEAD_LABELS and ENDINGS are frozen and hold the agreed values', () => {
  assert.ok(Object.isFrozen(LEAD_LABELS));
  assert.deepEqual(
    [...LEAD_LABELS],
    ['binnen_de_lijnen', 'buiten_de_lijnen', 'student', 'recruiter', 'bestaande_klant'],
  );
  assert.ok(Object.isFrozen(ENDINGS));
  assert.equal(ENDINGS.length, 5);
});

test('normalizeReport reports missing required fields instead of defaulting them', () => {
  const result = normalizeReport({ naam: 'Mark', email: '  ', label: 'student' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['email', 'uitdaging', 'ending']);
  assert.deepEqual(normalizeReport(null).missing, ['naam', 'email', 'uitdaging', 'label', 'ending']);
});

test('normalizeReport rejects a label outside LEAD_LABELS', () => {
  const result = normalizeReport({ ...required, label: 'vip' });
  assert.deepEqual(result, { ok: false, missing: ['label'] });
});

test('normalizeReport rejects an ending outside ENDINGS', () => {
  const result = normalizeReport({ ...required, ending: 'hung_up' });
  assert.deepEqual(result, { ok: false, missing: ['ending'] });
});

test('normalizeReport defaults vervolgactie owner to "Dave"', () => {
  const report = okReport({ ...required, vervolgactie: { wat: 'Offerte sturen' } });
  assert.deepEqual(report.vervolgactie, { wat: 'Offerte sturen', door: 'Dave' });
  const explicit = okReport({ ...required, vervolgactie: { wat: 'Bellen', door: 'Sanne' } });
  assert.equal(explicit.vervolgactie.door, 'Sanne');
});

test('normalizeReport trims strings and drops blank optional fields', () => {
  const report = okReport({ ...required, naam: '  Mark  ', telefoon: '   ', verwachting: '' });
  assert.equal(report.naam, 'Mark');
  assert.equal(report.telefoon, undefined);
  assert.equal(report.verwachting, undefined);
});

test('renderReportHtml escapes HTML in every field', () => {
  const evil = '<script>alert(1)</script>';
  const input = {};
  for (const key of Object.keys(full)) input[key] = evil;
  input.label = 'binnen_de_lijnen';
  input.ending = 'appointment';
  input.vervolgactie = { wat: evil, door: evil };
  const html = renderReportHtml(okReport(input));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  const quoted = renderReportHtml(okReport({ ...required, naam: '"><img src=x onerror=1>' }));
  assert.ok(!quoted.includes('<img'));
});

test('renderReportHtml prints "Niet aan de orde gekomen" for absent optional fields', () => {
  const html = renderReportHtml(okReport(required));
  // telefoon, beoogde_oplossing, verwachting, gespreksdoel, uitkomst, follow_up, vervolgactie, transcript
  assert.equal(html.split(ABSENT).length - 1, 8);
  assert.ok(!html.includes('undefined'));
  assert.ok(!html.includes('null'));
});

test('renderReportHtml puts the lead label in the first line of the body', () => {
  const html = renderReportHtml(okReport(full));
  const firstLine = html.split('\n').find((line) => line.trim() !== '' && !/^<\/?(html|head|body|meta|title)/i.test(line.trim()));
  assert.ok(firstLine.includes('Binnen de lijnen'), firstLine);
});

test('renderReportHtml shows the vervolgactie with its owner', () => {
  const html = renderReportHtml(okReport(full));
  assert.ok(html.includes('Offerte voorbereiden'));
  assert.ok(html.includes('Door: Dave'));
});

test('renderReportText puts the lead label on the first line', () => {
  const text = renderReportText(okReport(full));
  assert.equal(text.split('\n')[0], 'Type aanvraag: Binnen de lijnen');
});

test('renderReportText contains all eight sections in spec order', () => {
  const text = renderReportText(okReport(full));
  const headings = [
    'De uitdaging',
    'De beoogde oplossing',
    'Wat ze verwachten',
    'Het doel van het gesprek',
    'De uitkomst van het gesprek',
    'Follow-up actie',
    'Vervolgactie',
    'Transcriptie',
  ];
  let last = -1;
  for (const heading of headings) {
    const at = text.indexOf(`\n${heading}\n`);
    assert.ok(at > last, `${heading} missing or out of order`);
    last = at;
  }
});

test('renderReportText ends with the full transcript verbatim', () => {
  const text = renderReportText(okReport(full));
  assert.ok(text.endsWith(full.transcript));
});

test('renderReportText flags a report reconstructed from a transcript', () => {
  const fallback = renderReportText(okReport({ ...required, ending: 'fallback' }));
  const normal = renderReportText(okReport(required));
  assert.ok(fallback.includes('achteraf samengesteld uit het transcript'));
  assert.ok(!normal.includes('achteraf samengesteld'));
});
