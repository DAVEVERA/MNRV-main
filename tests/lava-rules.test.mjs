import assert from 'node:assert/strict';
import test from 'node:test';

import { BOOKING_RULES, generateSlots, validateSlot } from '../api/lava/_lib/rules.mjs';

// The date and time parts of an ISO string that carries an Amsterdam offset.
const localDate = (iso) => iso.slice(0, 10);
const localTime = (iso) => iso.slice(11, 16);

test('BOOKING_RULES holds the agreed values and is frozen', () => {
  assert.deepEqual(BOOKING_RULES, {
    timeZone: 'Europe/Amsterdam',
    workdays: [1, 2, 3, 4, 5],
    dayStartHour: 9,
    dayEndHour: 17,
    slotMinutes: 30,
    minLeadHours: 24,
    maxAheadDays: 21,
    maxPerDay: 2,
  });
  assert.ok(Object.isFrozen(BOOKING_RULES));
});

test('generateSlots skips weekends', () => {
  // Thursday 2026-10-01 10:00 local (CEST)
  const now = new Date('2026-10-01T08:00:00Z');
  const slots = generateSlots(now, [], {});
  const dates = new Set(slots.map((s) => localDate(s.start)));
  assert.ok(dates.size > 0);
  assert.ok(!dates.has('2026-10-03'), 'Saturday must not be offered');
  assert.ok(!dates.has('2026-10-04'), 'Sunday must not be offered');
  assert.ok(dates.has('2026-10-05'), 'Monday is offered');
});

test('generateSlots respects minLeadHours of 24', () => {
  // Friday 2026-10-02 16:50 local (CEST)
  const now = new Date('2026-10-02T14:50:00Z');
  const slots = generateSlots(now, [], {});
  assert.equal(slots[0].start, '2026-10-05T09:00:00+02:00');
  assert.equal(slots[0].end, '2026-10-05T09:30:00+02:00');
  assert.ok(!slots.some((s) => localDate(s.start) === '2026-10-03'));
});

test('generateSlots offers a slot exactly minLeadHours ahead', () => {
  // Monday 2026-10-05 09:00 local; Tuesday 09:00 is exactly 24h out.
  const now = new Date('2026-10-05T07:00:00Z');
  const slots = generateSlots(now, [], {});
  assert.equal(slots[0].start, '2026-10-06T09:00:00+02:00');
});

test('generateSlots excludes slots overlapping a busy block', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  const busy = [{ start: '2026-10-05T10:15:00+02:00', end: '2026-10-05T11:15:00+02:00' }];
  const starts = generateSlots(now, busy, {}).map((s) => s.start);
  assert.ok(starts.includes('2026-10-05T09:30:00+02:00'), 'ends before busy starts: free');
  assert.ok(!starts.includes('2026-10-05T10:00:00+02:00'), 'overlaps busy start');
  assert.ok(!starts.includes('2026-10-05T10:30:00+02:00'), 'inside busy');
  assert.ok(!starts.includes('2026-10-05T11:00:00+02:00'), 'overlaps busy end');
  assert.ok(starts.includes('2026-10-05T11:30:00+02:00'), 'starts after busy ends: free');
});

test('generateSlots treats a busy block that only touches a slot edge as free', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  const busy = [{ start: '2026-10-05T10:00:00+02:00', end: '2026-10-05T11:00:00+02:00' }];
  const starts = generateSlots(now, busy, {}).map((s) => s.start);
  assert.ok(starts.includes('2026-10-05T09:30:00+02:00'));
  assert.ok(!starts.includes('2026-10-05T10:00:00+02:00'));
  assert.ok(!starts.includes('2026-10-05T10:30:00+02:00'));
  assert.ok(starts.includes('2026-10-05T11:00:00+02:00'));
});

test('generateSlots drops days that already hold maxPerDay LAVA appointments', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  const dates = new Set(
    generateSlots(now, [], { '2026-10-05': 2, '2026-10-06': 1 }).map((s) => localDate(s.start)),
  );
  assert.ok(!dates.has('2026-10-05'), 'full day dropped');
  assert.ok(dates.has('2026-10-06'), 'day below the cap stays');
});

test('generateSlots returns slots on the half-hour grid inside 09:00-17:00 only', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  const slots = generateSlots(now, [], {});
  const monday = slots.filter((s) => localDate(s.start) === '2026-10-05').map((s) => localTime(s.start));
  assert.equal(monday.length, 16);
  assert.equal(monday[0], '09:00');
  assert.equal(monday[15], '16:30');
  for (const slot of slots) {
    assert.match(localTime(slot.start), /^(09|1[0-6]):(00|30)$/);
    assert.equal(Date.parse(slot.end) - Date.parse(slot.start), 30 * 60 * 1000);
  }
  const starts = slots.map((s) => Date.parse(s.start));
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b), 'ascending');
});

test('generateSlots does not offer slots beyond maxAheadDays', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  const last = generateSlots(now, [], {}).at(-1);
  assert.ok(Date.parse(last.start) <= now.getTime() + 21 * 24 * 60 * 60 * 1000);
  assert.equal(last.start, '2026-10-22T10:00:00+02:00');
});

test('generateSlots keeps local 09:00 across the October DST change', () => {
  // DST ends Sunday 2026-10-25 03:00 CEST -> 02:00 CET.
  // Thursday 2026-10-22 10:00 local: first slot is Friday 23rd 10:00 (still CEST).
  const now = new Date('2026-10-22T08:00:00Z');
  const slots = generateSlots(now, [], {});
  const starts = slots.map((s) => s.start);
  assert.equal(starts[0], '2026-10-23T10:00:00+02:00');
  assert.ok(starts.includes('2026-10-23T16:30:00+02:00'));
  assert.ok(starts.includes('2026-10-26T09:00:00+01:00'), 'Monday 09:00 is CET');
  assert.ok(starts.includes('2026-10-26T16:30:00+01:00'));
  assert.ok(!starts.some((s) => s.startsWith('2026-10-26') && s.endsWith('+02:00')));
  const monday = slots.find((s) => s.start === '2026-10-26T09:00:00+01:00');
  assert.equal(monday.end, '2026-10-26T09:30:00+01:00');
});

test('validateSlot rejects 08:30 with outside_hours', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  assert.deepEqual(validateSlot(now, '2026-10-06T08:30:00+02:00'), { ok: false, reason: 'outside_hours' });
});

test('validateSlot rejects a slot starting at 17:00 with outside_hours', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  assert.deepEqual(validateSlot(now, '2026-10-06T17:00:00+02:00'), { ok: false, reason: 'outside_hours' });
});

test('validateSlot rejects a Saturday with weekend', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  assert.deepEqual(validateSlot(now, '2026-10-10T10:00:00+02:00'), { ok: false, reason: 'weekend' });
});

test('validateSlot rejects a slot 23 hours out with too_soon', () => {
  const now = new Date('2026-10-05T08:00:00Z'); // Monday 10:00 local
  // Tuesday 09:00 local is 23 hours away.
  assert.deepEqual(validateSlot(now, '2026-10-06T09:00:00+02:00'), { ok: false, reason: 'too_soon' });
  // Tuesday 10:00 local is exactly 24 hours away and allowed.
  assert.deepEqual(validateSlot(now, '2026-10-06T10:00:00+02:00'), { ok: true });
});

test('validateSlot rejects a slot 22 days out with too_far', () => {
  const now = new Date('2026-10-01T08:00:00Z'); // Thursday 10:00 local
  // Friday 2026-10-23 10:00 local is exactly 22 days out.
  assert.deepEqual(validateSlot(now, '2026-10-23T10:00:00+02:00'), { ok: false, reason: 'too_far' });
});

test('validateSlot rejects 09:07 with not_on_grid', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  assert.deepEqual(validateSlot(now, '2026-10-06T09:07:00+02:00'), { ok: false, reason: 'not_on_grid' });
});

test('validateSlot rejects unparseable input with not_on_grid', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  assert.deepEqual(validateSlot(now, 'next tuesday'), { ok: false, reason: 'not_on_grid' });
});

test('validateSlot judges the Amsterdam wall clock, not the offset written in the string', () => {
  const now = new Date('2026-10-01T08:00:00Z');
  // 07:00Z is 09:00 local in CEST: valid even though written in UTC.
  assert.deepEqual(validateSlot(now, '2026-10-06T07:00:00Z'), { ok: true });
  // 06:30Z is 08:30 local: outside hours.
  assert.deepEqual(validateSlot(now, '2026-10-06T06:30:00Z'), { ok: false, reason: 'outside_hours' });
});

test('validateSlot accepts a Tuesday 14:00 three days out', () => {
  const now = new Date('2026-10-17T10:00:00Z'); // Saturday
  assert.deepEqual(validateSlot(now, '2026-10-20T14:00:00+02:00'), { ok: true });
});

test('validateSlot accepts the first Monday slot after the DST change at +01:00', () => {
  const now = new Date('2026-10-22T08:00:00Z');
  assert.deepEqual(validateSlot(now, '2026-10-26T09:00:00+01:00'), { ok: true });
});
