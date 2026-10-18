// ElevenLabs tool endpoint for booking one of LAVA's offered slots. It checks
// the rules and free/busy state again immediately before insertion. Supabase
// supplies the distributed mutex; a stable Google event id is a second guard.

import { createHash, randomUUID } from 'node:crypto';

import { getBusy, insertEvent } from './_lib/google.mjs';
import { verifyToolAuth } from './_lib/guards.mjs';
import { buildIcs } from './_lib/ics.mjs';
import { BOOKING_RULES, validateSlot } from './_lib/rules.mjs';
import { claimBookingSlot, createStoreClient } from './_lib/store.mjs';

const SLOT_MS = BOOKING_RULES.slotMinutes * 60 * 1000;

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

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw && typeof req[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    raw = Buffer.concat(chunks).toString('utf8');
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function eventIdForSlot(startIso) {
  const canonicalStart = new Date(startIso).toISOString();
  return `lava${createHash('sha256').update(canonicalStart).digest('hex').slice(0, 48)}`;
}

function overlapsSlot(entry, startMs, endMs) {
  const busyStart = Date.parse(entry?.start);
  const busyEnd = Date.parse(entry?.end);
  if (!Number.isFinite(busyStart) || !Number.isFinite(busyEnd)) {
    throw new TypeError(`Unreadable busy entry: ${JSON.stringify(entry)}`);
  }
  return busyStart < endMs && busyEnd > startMs;
}

export function createBookHandler({
  now = () => new Date(),
  getBusy: getBusyImpl = getBusy,
  insertEvent: insertEventImpl = insertEvent,
  createStoreClient: createStoreClientImpl = createStoreClient,
  claimBookingSlot: claimBookingSlotImpl = claimBookingSlot,
} = {}) {
  return async function bookHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, reason: 'method_not_allowed' });
    }
    if (!verifyToolAuth(req)) {
      return sendJson(res, 401, { ok: false, reason: 'unauthorized' });
    }

    const body = await readBody(req);
    const kind = cleanString(body.kind);
    const naam = cleanString(body.naam);
    const email = cleanString(body.email);
    const telefoon = cleanString(body.telefoon);
    const uitdaging = cleanString(body.uitdaging);
    const startIso = cleanString(body.startIso);
    const conversationId = cleanString(body.conversationId);

    if (
      !['intake', 'callback'].includes(kind) ||
      !naam ||
      !validEmail(email) ||
      !uitdaging ||
      !startIso ||
      !conversationId
    ) {
      return sendJson(res, 400, { ok: false, reason: 'missing_field' });
    }
    if (kind === 'callback' && !telefoon) {
      return sendJson(res, 400, { ok: false, reason: 'phone_required' });
    }

    const current = now();
    const validation = validateSlot(current, startIso);
    if (!validation.ok) {
      return sendJson(res, 400, { ok: false, reason: validation.reason });
    }

    const startMs = Date.parse(startIso);
    const endMs = startMs + SLOT_MS;
    const timeMin = new Date(startMs).toISOString();
    const timeMax = new Date(endMs).toISOString();

    try {
      const busy = await getBusyImpl(timeMin, timeMax);
      if (!Array.isArray(busy)) throw new TypeError('Calendar freeBusy result is not an array');
      if (busy.some((entry) => overlapsSlot(entry, startMs, endMs))) {
        return sendJson(res, 409, { ok: false, reason: 'slot_taken' });
      }

      const store = createStoreClientImpl();
      const wonSlot = await claimBookingSlotImpl(startIso, randomUUID(), store);
      if (!wonSlot) {
        return sendJson(res, 409, { ok: false, reason: 'slot_taken' });
      }

      const isCallback = kind === 'callback';
      const summary = `${isCallback ? 'Terugbelverzoek' : 'LAVA intake'} — ${naam}`;
      const description = [
        `Uitdaging: ${uitdaging}`,
        ...(isCallback ? [`Telefoon: ${telefoon}`] : []),
        `LAVA-conversatie: ${conversationId}`,
      ].join('\n');
      const appointment = await insertEventImpl({
        id: eventIdForSlot(startIso),
        startIso,
        endIso: timeMax,
        summary,
        description,
        withMeet: !isCallback,
      });
      const icsText = buildIcs(
        {
          uid: `${appointment.id}@mnrv.nl`,
          startIso,
          endIso: timeMax,
          summary,
          description,
          organizerEmail: process.env.INTAKE_ADMIN_EMAIL || 'info@mnrv.nl',
          attendeeEmail: email,
          meetUrl: appointment.meetUrl,
        },
        current,
      );
      return sendJson(res, 200, {
        ok: true,
        startIso,
        label: labelFormatter.format(new Date(startMs)),
        icsText,
      });
    } catch (err) {
      if (err?.status === 409) {
        return sendJson(res, 409, { ok: false, reason: 'slot_taken' });
      }
      console.error('lava book: calendar unavailable:', err.message);
      return sendJson(res, 503, { ok: false, reason: 'calendar_unavailable' });
    }
  };
}

export default createBookHandler();
