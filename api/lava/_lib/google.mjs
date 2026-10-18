// Google Calendar client for LAVA. Reports facts about the calendar; booking
// rules live in rules.mjs. Signs the service-account JWT with node:crypto, no SDK.
//
// Failure policy: every function throws on a failed, non-200 or unreadable
// Google response. Nothing returns an empty result on error, because an empty
// busy list would make every slot look free.

import { createSign, randomUUID } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TIME_ZONE = 'Europe/Amsterdam';
const DEFAULT_CALENDAR_ID = 'info@mnrv.nl';
// U+2014 em dash, as in the spec. A hyphen would silently match nothing.
const LAVA_PREFIXES = ['LAVA intake —', 'Terugbelverzoek —'];

export class GoogleConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GoogleConfigError';
  }
}

export class GoogleApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new GoogleConfigError(`Missing environment variable ${name}`);
  return value;
}

const calendarId = () => process.env.GOOGLE_CALENDAR_ID || DEFAULT_CALENDAR_ID;
const b64url = (input) => Buffer.from(input).toString('base64url');

async function readJson(response, what) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Handled below: an unreadable body is an error either way.
  }
  if (!response.ok) {
    const detail = body?.error?.message ?? body?.error_description ?? body?.error ?? '';
    throw new GoogleApiError(`${what} failed with HTTP ${response.status} ${detail}`.trim(), response.status);
  }
  if (body === null || typeof body !== 'object') {
    throw new GoogleApiError(`${what} returned an unreadable body`, response.status);
  }
  return body;
}

export async function getAccessToken(fetchImpl = fetch) {
  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  // Vercel stores the key on one line, with the newlines as literal "\n".
  const key = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  // Domain-wide delegation: act as this user instead of the service account.
  if (process.env.GOOGLE_IMPERSONATE_SUBJECT) claims.sub = process.env.GOOGLE_IMPERSONATE_SUBJECT;

  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  let signature;
  try {
    signature = createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url');
  } catch (err) {
    throw new GoogleConfigError(`GOOGLE_PRIVATE_KEY could not sign the JWT: ${err.message}`);
  }

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }).toString(),
  });
  const body = await readJson(response, 'Google token request');
  if (typeof body.access_token !== 'string' || !body.access_token) {
    throw new GoogleApiError('Google token response has no access_token', response.status);
  }
  return body.access_token;
}

async function authorizedFetch(url, init, what, fetchImpl) {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  return readJson(response, what);
}

// Always UTC "Z" form, so no consumer can read an offset-less time in the host zone.
function toUtcIso(value, what) {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms)) throw new GoogleApiError(`${what} has an unreadable time: ${JSON.stringify(value)}`);
  return new Date(ms).toISOString();
}

export async function getBusy(timeMinIso, timeMaxIso, fetchImpl = fetch) {
  const id = calendarId();
  const body = await authorizedFetch(
    `${API}/freeBusy`,
    {
      method: 'POST',
      body: JSON.stringify({ timeMin: timeMinIso, timeMax: timeMaxIso, timeZone: TIME_ZONE, items: [{ id }] }),
    },
    'Google freeBusy request',
    fetchImpl,
  );

  const calendar = body.calendars?.[id];
  const hasErrors = Array.isArray(calendar?.errors) && calendar.errors.length > 0;
  if (!calendar || hasErrors || !Array.isArray(calendar.busy)) {
    throw new GoogleApiError(`Google freeBusy has no usable result for calendar ${id}`);
  }
  return calendar.busy.map((entry) => ({
    start: toUtcIso(entry?.start, 'freeBusy entry'),
    end: toUtcIso(entry?.end, 'freeBusy entry'),
  }));
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// 'YYYY-MM-DD' of an instant on the Amsterdam wall clock, the key rules.mjs expects.
const localDateKey = (ms) => dayFormatter.format(new Date(ms));

export async function countLavaEventsPerDay(timeMinIso, timeMaxIso, fetchImpl = fetch) {
  const counts = {};
  let pageToken;
  do {
    const params = new URLSearchParams({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      singleEvents: 'true',
      timeZone: TIME_ZONE,
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const body = await authorizedFetch(
      `${API}/calendars/${encodeURIComponent(calendarId())}/events?${params}`,
      { method: 'GET' },
      'Google events.list request',
      fetchImpl,
    );
    if (!Array.isArray(body.items)) throw new GoogleApiError('Google events.list has no items array');

    for (const event of body.items) {
      if (!LAVA_PREFIXES.some((prefix) => event?.summary?.startsWith(prefix))) continue;
      // Skipping an unreadable LAVA event would undercount and allow a third booking.
      const ms = Date.parse(event.start?.dateTime ?? event.start?.date);
      if (!Number.isFinite(ms)) throw new GoogleApiError(`LAVA event has an unreadable start: ${event.id ?? ''}`);
      const key = localDateKey(ms);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return counts;
}

export async function insertEvent(event, fetchImpl = fetch) {
  const { startIso, endIso, summary, description, withMeet } = event;
  // Deliberately no `attendees`: the visitor's only invitation is the ICS email,
  // and a Google attendee would trigger a second one.
  const resource = {
    summary,
    description,
    start: { dateTime: startIso, timeZone: TIME_ZONE },
    end: { dateTime: endIso, timeZone: TIME_ZONE },
  };
  const insert = (res, withConference) =>
    authorizedFetch(
      `${API}/calendars/${encodeURIComponent(calendarId())}/events${withConference ? '?conferenceDataVersion=1' : ''}`,
      { method: 'POST', body: JSON.stringify(res) },
      'Google events.insert request',
      fetchImpl,
    );

  let body;
  let meetWarning;
  if (withMeet) {
    const withConference = {
      ...resource,
      conferenceData: {
        createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    };
    try {
      body = await insert(withConference, true);
    } catch (err) {
      // Only a rejection that names the conference degrades. Auth, 5xx and the
      // rest keep throwing: the Meet link is a convenience, the booking is not.
      if (!(err instanceof GoogleApiError && err.status === 400 && /conference/i.test(err.message))) throw err;
      meetWarning = `Meet link refused, event booked without it: ${err.message}`;
    }
  }
  if (!body) body = await insert(resource, false);
  if (typeof body.id !== 'string' || !body.id) throw new GoogleApiError('Google events.insert returned no event id');

  const result = { id: body.id, htmlLink: body.htmlLink };
  const meetUrl =
    body.hangoutLink ?? body.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri;
  if (meetUrl) {
    result.meetUrl = meetUrl;
  } else if (withMeet && !meetWarning) {
    // Event created, but Google reported a failed or still-pending conference.
    const status = body.conferenceData?.createRequest?.status?.statusCode ?? 'missing';
    meetWarning = `Event booked without a Meet link (conference status: ${status})`;
  }
  if (meetWarning) {
    result.meetWarning = meetWarning;
    console.warn(`[lava/google] ${meetWarning}`);
  }
  return result;
}
