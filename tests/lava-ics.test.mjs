import assert from 'node:assert/strict';
import test from 'node:test';

import { buildIcs } from '../api/lava/_lib/ics.mjs';

const base = {
  uid: 'lava-conv123@mnrv.nl',
  startIso: '2026-10-20T10:00:00+02:00',
  endIso: '2026-10-20T10:30:00+02:00',
  summary: 'LAVA intake — Mark de Wit',
  description: 'Intake gesprek',
  organizerEmail: 'info@mnrv.nl',
  attendeeEmail: 'mark@example.nl',
};
const NOW = new Date('2026-10-18T12:00:00Z');

// Undo RFC 5545 folding so assertions can look at logical lines.
const unfold = (ics) => ics.replace(/\r\n /g, '');
const logicalLines = (ics) => unfold(ics).split('\r\n').filter(Boolean);

test('buildIcs emits VCALENDAR/VEVENT with VERSION:2.0 and METHOD:REQUEST', () => {
  const lines = logicalLines(buildIcs(base, NOW));
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines.at(-1), 'END:VCALENDAR');
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.includes('METHOD:REQUEST'));
  assert.ok(lines.includes('BEGIN:VEVENT'));
  assert.ok(lines.includes('END:VEVENT'));
  assert.ok(lines.includes('UID:lava-conv123@mnrv.nl'));
  assert.ok(lines.includes('DTSTAMP:20261018T120000Z'));
  assert.ok(lines.includes('ORGANIZER:mailto:info@mnrv.nl'));
  assert.ok(lines.includes('ATTENDEE:mailto:mark@example.nl'));
});

test('buildIcs writes DTSTART/DTEND as UTC basic format ending in Z', () => {
  const lines = logicalLines(buildIcs(base, NOW));
  // 10:00 and 10:30 in Amsterdam (CEST, +02:00) are 08:00 and 08:30 UTC.
  assert.ok(lines.includes('DTSTART:20261020T080000Z'));
  assert.ok(lines.includes('DTEND:20261020T083000Z'));
});

test('buildIcs folds lines longer than 75 octets', () => {
  const ics = buildIcs({ ...base, summary: 'Ünïcödé '.repeat(30) }, NOW);
  const physical = ics.split('\r\n').filter(Boolean);
  for (const line of physical) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line too long: ${line}`);
  }
  assert.ok(physical.some((l) => l.startsWith(' ')), 'expected a continuation line');
  // Unfolding restores the full text, so no character was split or lost.
  assert.ok(unfold(ics).includes(`SUMMARY:${'Ünïcödé '.repeat(30).trim()}`));
});

test('buildIcs folds a long Dutch title with an em dash without splitting a UTF-8 sequence', () => {
  const title = 'LAVA intake — Mark de Wit '.repeat(5).trim();
  const ics = buildIcs({ ...base, summary: title }, NOW);
  const physical = ics.split('\r\n').filter(Boolean);
  assert.ok(physical.some((l) => l.startsWith(' ')), 'expected folding');
  // Work on bytes: a fatal decoder throws if a line cuts a multi-byte sequence.
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const byteLines = [];
  let start = 0;
  const bytes = Buffer.from(ics, 'utf8');
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) {
      byteLines.push(bytes.subarray(start, i));
      start = i + 2;
      i++;
    }
  }
  for (const line of byteLines) {
    assert.ok(line.length <= 75, 'line over 75 octets');
    assert.ok(!decoder.decode(line).includes('�'));
  }
  assert.ok(unfold(ics).includes(`SUMMARY:${title}`));
});

for (const field of ['uid', 'organizerEmail', 'attendeeEmail']) {
  test(`buildIcs throws when ${field} contains a line break`, () => {
    for (const bad of ['a\r\nX-INJECT:1', 'a\nX-INJECT:1', 'a\rb']) {
      assert.throws(() => buildIcs({ ...base, [field]: bad }, NOW), new RegExp(field));
    }
  });
}

test('buildIcs escapes commas, semicolons and newlines in SUMMARY and DESCRIPTION', () => {
  const ics = buildIcs(
    { ...base, summary: 'a, b; c\\d', description: 'regel een\nregel twee, met; tekens' },
    NOW,
  );
  const lines = logicalLines(ics);
  assert.ok(lines.includes('SUMMARY:a\\, b\\; c\\\\d'));
  assert.ok(lines.includes('DESCRIPTION:regel een\\nregel twee\\, met\\; tekens'));
});

test('buildIcs includes the Meet url in DESCRIPTION when given and omits the line when not', () => {
  const withMeet = logicalLines(buildIcs({ ...base, meetUrl: 'https://meet.google.com/abc-defg-hij' }, NOW));
  const desc = withMeet.find((l) => l.startsWith('DESCRIPTION:'));
  assert.ok(desc.includes('https://meet.google.com/abc-defg-hij'));

  const without = logicalLines(buildIcs(base, NOW));
  const plain = without.find((l) => l.startsWith('DESCRIPTION:'));
  assert.equal(plain, 'DESCRIPTION:Intake gesprek');
  assert.ok(!unfold(buildIcs(base, NOW)).includes('meet.google.com'));
});

test('buildIcs terminates every line with CRLF', () => {
  const ics = buildIcs({ ...base, description: 'a\nb', meetUrl: 'https://meet.google.com/x' }, NOW);
  assert.ok(ics.endsWith('\r\n'));
  assert.ok(!/(^|[^\r])\n/.test(ics), 'found a bare LF');
  assert.ok(!/\r(?!\n)/.test(ics), 'found a bare CR');
});
