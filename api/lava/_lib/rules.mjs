// Booking rules for LAVA: decides WHEN an appointment may be offered or accepted.
// Pure and dependency-free. Timezone arithmetic uses Intl.DateTimeFormat only.

export const BOOKING_RULES = Object.freeze({
  timeZone: 'Europe/Amsterdam',
  workdays: Object.freeze([1, 2, 3, 4, 5]), // Monday to Friday (0 = Sunday)
  dayStartHour: 9,
  dayEndHour: 17,
  slotMinutes: 30,
  minLeadHours: 24,
  maxAheadDays: 21,
  maxPerDay: 2,
});

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BOOKING_RULES.timeZone,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Wall-clock parts of an instant in the booking timezone.
function localParts(date) {
  const parts = {};
  for (const { type, value } of formatter.formatToParts(date)) {
    if (type !== 'literal') parts[type] = Number(value);
  }
  return parts;
}

// Offset of the booking timezone from UTC at an instant, in minutes (+60 or +120).
function offsetMinutes(date) {
  const p = localParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MINUTE_MS);
}

// ISO 8601 string with the local offset, e.g. 2026-10-26T09:00:00+01:00.
function toLocalIso(date) {
  const p = localParts(date);
  const pad = (n) => String(n).padStart(2, '0');
  const offset = offsetMinutes(date);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return (
    `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

// The instant at which the booking timezone shows the given wall-clock time.
function localToInstant(year, month, day, hour, minute) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall - offsetMinutes(new Date(wall)) * MINUTE_MS;
  // Re-check near a DST change, where the first guess may use the wrong offset.
  const corrected = wall - offsetMinutes(new Date(instant)) * MINUTE_MS;
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

// Day of week (0 = Sunday) of a calendar date.
function weekdayOf(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dateKey(year, month, day) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Free slots LAVA may offer, ascending, as ISO strings with the Amsterdam offset.
 * `bookedPerDay` is keyed by local date, 'YYYY-MM-DD'.
 */
export function generateSlots(now, busy, bookedPerDay) {
  const rules = BOOKING_RULES;
  const earliest = now.getTime() + rules.minLeadHours * HOUR_MS;
  const latest = now.getTime() + rules.maxAheadDays * DAY_MS;
  const busyRanges = busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
  const slotMs = rules.slotMinutes * MINUTE_MS;
  const slots = [];

  // Walk calendar days by stepping a UTC date; the local calendar date is what matters.
  const today = localParts(now);
  const dayCount = rules.maxAheadDays + 2;
  for (let i = 0; i <= dayCount; i += 1) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const date = day.getUTCDate();

    if (!rules.workdays.includes(weekdayOf(year, month, date))) continue;
    if ((bookedPerDay?.[dateKey(year, month, date)] ?? 0) >= rules.maxPerDay) continue;

    const slotsPerDay = ((rules.dayEndHour - rules.dayStartHour) * 60) / rules.slotMinutes;
    for (let n = 0; n < slotsPerDay; n += 1) {
      const minutes = rules.dayStartHour * 60 + n * rules.slotMinutes;
      const start = localToInstant(year, month, date, Math.floor(minutes / 60), minutes % 60);
      const startMs = start.getTime();
      const endMs = startMs + slotMs;

      if (startMs < earliest || startMs > latest) continue;
      if (busyRanges.some((b) => b.start < endMs && b.end > startMs)) continue;

      slots.push({ start: toLocalIso(start), end: toLocalIso(new Date(endMs)) });
    }
  }
  return slots;
}

/**
 * Whether a requested start time is legal. Judges the Amsterdam wall clock,
 * whatever offset the string is written in.
 */
export function validateSlot(now, startIso) {
  const rules = BOOKING_RULES;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return { ok: false, reason: 'not_on_grid' };

  const p = localParts(start);
  if (!rules.workdays.includes(weekdayOf(p.year, p.month, p.day))) {
    return { ok: false, reason: 'weekend' };
  }

  const minutes = p.hour * 60 + p.minute;
  const lastStart = rules.dayEndHour * 60 - rules.slotMinutes;
  if (minutes < rules.dayStartHour * 60 || minutes > lastStart) {
    return { ok: false, reason: 'outside_hours' };
  }
  if (p.second !== 0 || start.getTime() % 1000 !== 0 || (minutes - rules.dayStartHour * 60) % rules.slotMinutes !== 0) {
    return { ok: false, reason: 'not_on_grid' };
  }

  const ahead = start.getTime() - now.getTime();
  if (ahead < rules.minLeadHours * HOUR_MS) return { ok: false, reason: 'too_soon' };
  if (ahead > rules.maxAheadDays * DAY_MS) return { ok: false, reason: 'too_far' };
  return { ok: true };
}
