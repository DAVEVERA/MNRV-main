// ElevenLabs tool endpoint for offering appointment times. Calendar I/O stays
// in google.mjs; this endpoint applies LAVA's booking rules and returns only
// three short, speakable options.

import { countLavaEventsPerDay, getBusy } from './_lib/google.mjs';
import { verifyToolAuth } from './_lib/guards.mjs';
import { BOOKING_RULES, generateSlots } from './_lib/rules.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 3;

const labelFormatter = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: BOOKING_RULES.timeZone,
});

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function slotLabel(startIso) {
  return labelFormatter.format(new Date(startIso));
}

export function createAvailabilityHandler({
  now = () => new Date(),
  getBusy: getBusyImpl = getBusy,
  countLavaEventsPerDay: countLavaEventsPerDayImpl = countLavaEventsPerDay,
} = {}) {
  return async function availabilityHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }
    if (!verifyToolAuth(req)) {
      return sendJson(res, 401, { error: 'unauthorized' });
    }

    const current = now();
    const timeMin = current.toISOString();
    const timeMax = new Date(
      current.getTime() + BOOKING_RULES.maxAheadDays * DAY_MS,
    ).toISOString();

    try {
      const [busy, bookedPerDay] = await Promise.all([
        getBusyImpl(timeMin, timeMax),
        countLavaEventsPerDayImpl(timeMin, timeMax),
      ]);
      const slots = generateSlots(current, busy, bookedPerDay)
        .slice(0, MAX_RESULTS)
        .map(({ start }) => ({ start, label: slotLabel(start) }));
      return sendJson(res, 200, { slots });
    } catch (err) {
      console.error('lava availability: calendar unavailable:', err.message);
      return sendJson(res, 503, { error: 'calendar_unavailable' });
    }
  };
}

export default createAvailabilityHandler();
