// --- google.mjs (Task 4) ---
import assert from 'node:assert/strict';
import { createHash, createVerify, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import { createAvailabilityHandler } from '../api/lava/availability.mjs';
import { createBookHandler } from '../api/lava/book.mjs';
import sessionHandler from '../api/lava/session.mjs';

import {
  countLavaEventsPerDay,
  getAccessToken,
  getBusy,
  insertEvent,
  LAVA_PREFIXES,
} from '../api/lava/_lib/google.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const ENV_KEYS = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_IMPERSONATE_SUBJECT',
  'ELEVENLABS_API_KEY',
  'LAVA_AGENT_ID',
  'LAVA_DAILY_LIMIT',
  'LAVA_TOOL_SECRET',
  'TURNSTILE_SECRET_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

// Runs fn with a controlled Google environment, then restores the previous one.
async function withEnv(overrides, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'lava@proj.iam.gserviceaccount.com',
    // Vercel stores the key on one line with literal backslash-n sequences.
    GOOGLE_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
    ...overrides,
  });
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete process.env[k];
  try {
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Stub that answers the token endpoint and routes every other call to `handler`.
function stub(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const call = { url: String(url), init, body: init.body };
    calls.push(call);
    if (call.url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'tok-1' });
    return handler(call);
  };
  return { fetchImpl, calls, api: () => calls.filter((c) => !c.url.includes('oauth2')) };
}

const b64urlJson = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

test('getAccessToken signs a JWT with RS256 and posts it to the Google token endpoint', async () => {
  await withEnv({ GOOGLE_IMPERSONATE_SUBJECT: 'info@mnrv.nl' }, async () => {
    const s = stub(() => json({}));
    const token = await getAccessToken(s.fetchImpl);
    assert.equal(token, 'tok-1');

    const [call] = s.calls;
    assert.equal(call.url, 'https://oauth2.googleapis.com/token');
    assert.equal(call.init.method, 'POST');
    const form = new URLSearchParams(call.body);
    assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');

    const [h, p, sig] = form.get('assertion').split('.');
    assert.deepEqual(b64urlJson(h), { alg: 'RS256', typ: 'JWT' });
    const claims = b64urlJson(p);
    assert.equal(claims.iss, 'lava@proj.iam.gserviceaccount.com');
    assert.equal(claims.sub, 'info@mnrv.nl');
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/calendar');
    assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
    assert.equal(claims.exp - claims.iat, 3600);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    assert.equal(verifier.verify(publicKey, Buffer.from(sig, 'base64url')), true);
  });
});

test('getAccessToken omits sub when no impersonation subject is configured', async () => {
  await withEnv({}, async () => {
    const s = stub(() => json({}));
    await getAccessToken(s.fetchImpl);
    const claims = b64urlJson(new URLSearchParams(s.calls[0].body).get('assertion').split('.')[1]);
    assert.equal('sub' in claims, false);
  });
});

test('getAccessToken throws a named error when GOOGLE_PRIVATE_KEY is absent', async () => {
  await withEnv({ GOOGLE_PRIVATE_KEY: undefined }, async () => {
    const s = stub(() => json({}));
    await assert.rejects(getAccessToken(s.fetchImpl), (err) => {
      assert.equal(err.name, 'GoogleConfigError');
      assert.match(err.message, /GOOGLE_PRIVATE_KEY/);
      return true;
    });
    assert.equal(s.calls.length, 0);
  });
});

test('getAccessToken throws when the token endpoint refuses', async () => {
  await withEnv({}, async () => {
    const fetchImpl = async () => json({ error: 'invalid_grant' }, 400);
    await assert.rejects(getAccessToken(fetchImpl), { name: 'GoogleApiError' });
  });
});

test('getBusy returns the freeBusy busy array for the configured calendar', async () => {
  await withEnv({ GOOGLE_CALENDAR_ID: 'agenda@mnrv.nl' }, async () => {
    const s = stub(() =>
      json({
        calendars: {
          'agenda@mnrv.nl': {
            busy: [
              { start: '2026-10-20T08:00:00Z', end: '2026-10-20T09:00:00Z' },
              { start: '2026-10-21T09:00:00+02:00', end: '2026-10-21T09:30:00+02:00' },
            ],
          },
        },
      }),
    );
    const busy = await getBusy('2026-10-19T00:00:00Z', '2026-11-09T00:00:00Z', s.fetchImpl);

    // Offsets are normalised to UTC Z so no consumer can misread them in the host zone.
    assert.deepEqual(busy, [
      { start: '2026-10-20T08:00:00.000Z', end: '2026-10-20T09:00:00.000Z' },
      { start: '2026-10-21T07:00:00.000Z', end: '2026-10-21T07:30:00.000Z' },
    ]);

    const [call] = s.api();
    assert.equal(call.url, 'https://www.googleapis.com/calendar/v3/freeBusy');
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.headers.authorization, 'Bearer tok-1');
    assert.deepEqual(JSON.parse(call.body), {
      timeMin: '2026-10-19T00:00:00Z',
      timeMax: '2026-11-09T00:00:00Z',
      timeZone: 'Europe/Amsterdam',
      items: [{ id: 'agenda@mnrv.nl' }],
    });
  });
});

test('getBusy defaults the calendar to info@mnrv.nl', async () => {
  await withEnv({ GOOGLE_CALENDAR_ID: undefined }, async () => {
    const s = stub(() => json({ calendars: { 'info@mnrv.nl': { busy: [] } } }));
    assert.deepEqual(await getBusy('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z', s.fetchImpl), []);
    assert.deepEqual(JSON.parse(s.api()[0].body).items, [{ id: 'info@mnrv.nl' }]);
  });
});

test('getBusy throws on a non-200 response instead of returning an empty list', async () => {
  await withEnv({}, async () => {
    const s = stub(() => json({ error: { message: 'boom' } }, 503));
    await assert.rejects(getBusy('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z', s.fetchImpl), {
      name: 'GoogleApiError',
    });
  });
});

test('getBusy throws when the calendar is missing from the response or reports errors', async () => {
  await withEnv({}, async () => {
    for (const body of [
      {},
      { calendars: {} },
      { calendars: { 'info@mnrv.nl': {} } },
      { calendars: { 'info@mnrv.nl': { errors: [{ reason: 'notFound' }], busy: [] } } },
    ]) {
      const s = stub(() => json(body));
      await assert.rejects(
        getBusy('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z', s.fetchImpl),
        { name: 'GoogleApiError' },
        JSON.stringify(body),
      );
    }
  });
});

test('getBusy throws on an unreadable busy entry', async () => {
  await withEnv({}, async () => {
    for (const entry of [{ start: 'nope', end: '2026-10-20T09:00:00Z' }, { start: '2026-10-20T09:00:00Z' }]) {
      const s = stub(() => json({ calendars: { 'info@mnrv.nl': { busy: [entry] } } }));
      await assert.rejects(getBusy('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z', s.fetchImpl), {
        name: 'GoogleApiError',
      });
    }
  });
});

test('countLavaEventsPerDay counts only LAVA intake and Terugbelverzoek summaries', async () => {
  await withEnv({}, async () => {
    const ev = (summary, dateTime) => ({ summary, start: { dateTime } });
    const s = stub(() =>
      json({
        items: [
          ev('LAVA intake — Mark de Wit', '2026-10-20T10:00:00+02:00'),
          ev('Terugbelverzoek — Sanne', '2026-10-20T11:00:00+02:00'),
          ev('Lunch met klant', '2026-10-20T12:00:00+02:00'),
          ev('LAVA intake - hyphen impostor', '2026-10-20T13:00:00+02:00'),
          ev('LAVA intake — Joris', '2026-10-21T09:00:00+02:00'),
          // 23:30 UTC on the 21st is already the 22nd in Amsterdam.
          ev('LAVA intake — Late', '2026-10-21T23:30:00Z'),
        ],
      }),
    );
    const counts = await countLavaEventsPerDay('2026-10-19T00:00:00Z', '2026-11-09T00:00:00Z', s.fetchImpl);
    assert.deepEqual(counts, { '2026-10-20': 2, '2026-10-21': 1, '2026-10-22': 1 });

    const url = new URL(s.api()[0].url);
    assert.equal(decodeURIComponent(url.pathname), '/calendar/v3/calendars/info@mnrv.nl/events');
    assert.equal(url.searchParams.get('singleEvents'), 'true');
    assert.equal(url.searchParams.get('timeMin'), '2026-10-19T00:00:00Z');
    assert.equal(url.searchParams.get('timeMax'), '2026-11-09T00:00:00Z');
    assert.equal(s.api()[0].init.headers.authorization, 'Bearer tok-1');
  });
});

test('countLavaEventsPerDay throws on a matching event without a readable start', async () => {
  await withEnv({}, async () => {
    const s = stub(() => json({ items: [{ summary: 'LAVA intake — Zonder start' }] }));
    await assert.rejects(countLavaEventsPerDay('2026-10-19T00:00:00Z', '2026-11-09T00:00:00Z', s.fetchImpl), {
      name: 'GoogleApiError',
    });
  });
});

test('countLavaEventsPerDay follows pagination and throws on a non-200', async () => {
  await withEnv({}, async () => {
    const pages = [
      { items: [{ summary: 'LAVA intake — A', start: { dateTime: '2026-10-20T10:00:00+02:00' } }], nextPageToken: 'p2' },
      { items: [{ summary: 'LAVA intake — B', start: { dateTime: '2026-10-20T11:00:00+02:00' } }] },
    ];
    let i = 0;
    const s = stub(() => json(pages[i++]));
    const counts = await countLavaEventsPerDay('2026-10-19T00:00:00Z', '2026-11-09T00:00:00Z', s.fetchImpl);
    assert.deepEqual(counts, { '2026-10-20': 2 });
    assert.equal(new URL(s.api()[1].url).searchParams.get('pageToken'), 'p2');

    const bad = stub(() => json({}, 500));
    await assert.rejects(countLavaEventsPerDay('2026-10-19T00:00:00Z', '2026-11-09T00:00:00Z', bad.fetchImpl), {
      name: 'GoogleApiError',
    });
  });
});

const EVENT = {
  startIso: '2026-10-20T10:00:00+02:00',
  endIso: '2026-10-20T10:30:00+02:00',
  summary: 'LAVA intake — Mark de Wit',
  description: 'Intake gesprek',
};

test('insertEvent sends no attendees field', async () => {
  await withEnv({}, async () => {
    const s = stub(() => json({ id: 'evt1', htmlLink: 'https://calendar.google.com/e/evt1' }));
    const result = await insertEvent({ ...EVENT, withMeet: false }, s.fetchImpl);
    assert.deepEqual(result, { id: 'evt1', htmlLink: 'https://calendar.google.com/e/evt1' });

    const [call] = s.api();
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.headers.authorization, 'Bearer tok-1');
    const body = JSON.parse(call.body);
    assert.equal('attendees' in body, false);
    assert.deepEqual(body.start, { dateTime: '2026-10-20T10:00:00+02:00', timeZone: 'Europe/Amsterdam' });
    assert.deepEqual(body.end, { dateTime: '2026-10-20T10:30:00+02:00', timeZone: 'Europe/Amsterdam' });
    assert.equal(body.summary, 'LAVA intake — Mark de Wit');
    assert.equal(body.description, 'Intake gesprek');
  });
});

test('insertEvent sends a caller-supplied collision id to Google', async () => {
  await withEnv({}, async () => {
    const s = stub(() => json({ id: 'lavaabc123', htmlLink: 'l' }));
    await insertEvent({ ...EVENT, id: 'lavaabc123', withMeet: false }, s.fetchImpl);
    assert.equal(JSON.parse(s.api()[0].body).id, 'lavaabc123');
  });
});

test('insertEvent requests conferenceData only when withMeet is true', async () => {
  await withEnv({}, async () => {
    const without = stub(() => json({ id: 'a', htmlLink: 'l' }));
    await insertEvent({ ...EVENT, withMeet: false }, without.fetchImpl);
    assert.equal('conferenceData' in JSON.parse(without.api()[0].body), false);
    assert.equal(new URL(without.api()[0].url).searchParams.has('conferenceDataVersion'), false);

    const withMeet = stub(() =>
      json({ id: 'b', htmlLink: 'l', hangoutLink: 'https://meet.google.com/abc-defg-hij' }),
    );
    const result = await insertEvent({ ...EVENT, withMeet: true }, withMeet.fetchImpl);
    const body = JSON.parse(withMeet.api()[0].body);
    assert.equal(body.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
    assert.ok(body.conferenceData.createRequest.requestId);
    assert.equal('attendees' in body, false);
    assert.equal(new URL(withMeet.api()[0].url).searchParams.get('conferenceDataVersion'), '1');
    assert.equal(result.meetUrl, 'https://meet.google.com/abc-defg-hij');
  });
});

test('insertEvent throws on a non-200 response and on a response without an id', async () => {
  await withEnv({}, async () => {
    const bad = stub(() => json({ error: {} }, 403));
    await assert.rejects(insertEvent({ ...EVENT, withMeet: false }, bad.fetchImpl), { name: 'GoogleApiError' });
    const noId = stub(() => json({}));
    await assert.rejects(insertEvent({ ...EVENT, withMeet: false }, noId.fetchImpl), { name: 'GoogleApiError' });
  });
});

test('insertEvent still books the event when Google refuses the conference (400 naming conferenceData)', async () => {
  await withEnv({}, async () => {
    const warn = console.warn;
    const warnings = [];
    console.warn = (m) => warnings.push(m);
    try {
      const s = stub((call) =>
        JSON.parse(call.body).conferenceData
          ? json({ error: { code: 400, message: 'Invalid conference type value.' } }, 400)
          : json({ id: 'evt-nomeet', htmlLink: 'https://calendar.google.com/e/nomeet' }),
      );
      const result = await insertEvent({ ...EVENT, withMeet: true }, s.fetchImpl);

      const inserts = s.api();
      assert.equal(inserts.length, 2);
      const retry = JSON.parse(inserts[1].body);
      assert.equal('conferenceData' in retry, false);
      assert.equal('attendees' in retry, false);
      assert.equal(new URL(inserts[1].url).searchParams.has('conferenceDataVersion'), false);
      assert.equal(result.id, 'evt-nomeet');
      assert.equal('meetUrl' in result, false);
      assert.match(result.meetWarning, /Invalid conference type/);
      assert.equal(warnings.length, 1);
    } finally {
      console.warn = warn;
    }
  });
});

test('insertEvent returns no meetUrl when the event is created but the conference failed', async () => {
  await withEnv({}, async () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const s = stub(() =>
        json({
          id: 'evt-failed',
          htmlLink: 'l',
          conferenceData: { createRequest: { status: { statusCode: 'failure' } } },
        }),
      );
      const result = await insertEvent({ ...EVENT, withMeet: true }, s.fetchImpl);
      assert.equal(s.api().length, 1);
      assert.equal(result.id, 'evt-failed');
      assert.equal('meetUrl' in result, false);
      assert.match(result.meetWarning, /failure/);
    } finally {
      console.warn = warn;
    }
  });
});

test('insertEvent does not degrade on non-conference failures when withMeet is true', async () => {
  await withEnv({}, async () => {
    for (const [status, message] of [[500, 'backend error'], [403, 'forbidden'], [400, 'Invalid start time']]) {
      const s = stub(() => json({ error: { message } }, status));
      await assert.rejects(insertEvent({ ...EVENT, withMeet: true }, s.fetchImpl), { name: 'GoogleApiError' });
      assert.equal(s.api().length, 1);
    }
  });
});

test('insertEvent degrades on a 403 forbiddenForServiceAccounts conference refusal', async () => {
  await withEnv({}, async () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const s = stub((call) =>
        JSON.parse(call.body).conferenceData
          ? json({ error: { code: 403, message: 'Service accounts cannot do this.', errors: [{ reason: 'forbiddenForServiceAccounts' }] } }, 403)
          : json({ id: 'evt-403', htmlLink: 'l' }),
      );
      const result = await insertEvent({ ...EVENT, withMeet: true }, s.fetchImpl);
      assert.equal(s.api().length, 2);
      assert.equal(result.id, 'evt-403');
      assert.equal('meetUrl' in result, false);
      assert.match(result.meetWarning, /forbiddenForServiceAccounts|Service accounts/);
    } finally {
      console.warn = warn;
    }
  });
});

test('insertEvent still throws on an unrelated 403 reason when withMeet is true', async () => {
  await withEnv({}, async () => {
    const s = stub(() => json({ error: { message: 'Forbidden', errors: [{ reason: 'forbidden' }] } }, 403));
    await assert.rejects(insertEvent({ ...EVENT, withMeet: true }, s.fetchImpl), (err) => {
      assert.equal(err.name, 'GoogleApiError');
      assert.equal(err.reason, 'forbidden');
      return true;
    });
    assert.equal(s.api().length, 1);
  });
});

test('GoogleApiError keeps a string detail and never prints [object Object]', async () => {
  await withEnv({}, async () => {
    const s = stub(() => json({ error: { code: 500 } }, 500));
    await assert.rejects(insertEvent({ ...EVENT, withMeet: false }, s.fetchImpl), (err) => {
      assert.doesNotMatch(err.message, /\[object Object\]/);
      return true;
    });
  });
});

test('LAVA_PREFIXES uses the em dash and matches what the endpoint will write', () => {
  assert.deepEqual(LAVA_PREFIXES, ['LAVA intake —', 'Terugbelverzoek —']);
  assert.ok(LAVA_PREFIXES.every((p) => p.endsWith('—')));
});

test('countLavaEventsPerDay keys are YYYY-MM-DD in Amsterdam time, including around DST', async () => {
  await withEnv({}, async () => {
    const s = stub(() =>
      json({
        items: [
          { summary: 'LAVA intake — X', start: { dateTime: '2026-03-29T09:00:00+02:00' } },
          { summary: 'LAVA intake — Y', start: { dateTime: '2026-01-05T08:05:00Z' } },
        ],
      }),
    );
    const counts = await countLavaEventsPerDay('2026-01-01T00:00:00Z', '2026-04-01T00:00:00Z', s.fetchImpl);
    assert.deepEqual(counts, { '2026-03-29': 1, '2026-01-05': 1 });
  });
});

// --- session.mjs (Task 6) ---
// Requests are hand-made: { method, headers, body } with `body` already parsed
// (what Vercel's Node runtime provides for JSON). The handler also reads the
// raw stream when `body` is absent. `res` is a recorder with the Node surface
// the handler uses. global fetch is replaced for the duration of one test.

const SESSION_ENV = {
  ELEVENLABS_API_KEY: 'xi-secret-key-123',
  LAVA_AGENT_ID: 'agent_abc',
  LAVA_TOOL_SECRET: 'tool-secret',
  TURNSTILE_SECRET_KEY: 'ts-secret',
  SUPABASE_URL: 'https://db.example.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srv-key',
};

function fakeReq({ method = 'POST', body = { turnstileToken: 'cf-ok' }, headers = {} } = {}) {
  return { method, body, headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1', ...headers } };
}

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) {
      res.headers[k.toLowerCase()] = v;
    },
    end(chunk = '') {
      res.body += chunk;
    },
  };
  return res;
}

// Routes by host so a test can see exactly which upstreams were called, in order.
async function runSession({ req = fakeReq(), turnstileOk = true, count = 0, mint, record } = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes('challenges.cloudflare.com')) return json({ success: turnstileOk });
    if (u.includes('db.example.co') && init.method === 'HEAD') {
      if (count instanceof Error) throw count;
      return new Response(null, { status: 200, headers: { 'content-range': `*/${count}` } });
    }
    if (u.includes('db.example.co')) {
      if (record) return record(u, init);
      return new Response(null, { status: 201 });
    }
    if (u.includes('api.elevenlabs.io')) {
      return mint ? mint(u, init) : json({ token: 'conv-token-1' });
    }
    throw new Error(`unexpected fetch ${u}`);
  };
  const res = fakeRes();
  try {
    await sessionHandler(req, res);
  } finally {
    globalThis.fetch = realFetch;
  }
  return { res, calls, json: res.body ? JSON.parse(res.body) : undefined };
}

const hitsEleven = (calls) => calls.some((c) => c.url.includes('api.elevenlabs.io'));
const grantPosts = (calls) =>
  calls.filter((c) => c.init.method === 'POST' && c.url.includes('db.example.co'));
const sha = (ip) => createHash('sha256').update(ip + 'tool-secret').digest('hex');

test('session rejects a non-POST method with 405 and calls nothing', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession({ req: fakeReq({ method: 'GET' }) });
    assert.equal(r.res.statusCode, 405);
    assert.equal(r.res.headers.allow, 'POST');
    assert.equal(r.calls.length, 0);
  });
});

test('session returns 403 bot_check_failed when Turnstile fails, before any other call', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession({ turnstileOk: false });
    assert.equal(r.res.statusCode, 403);
    assert.deepEqual(r.json, { error: 'bot_check_failed' });
    assert.equal(r.calls.length, 1);
    assert.match(r.calls[0].url, /challenges\.cloudflare\.com/);
  });
});

test('session returns 403 when the body has no turnstileToken', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession({ req: fakeReq({ body: {} }) });
    assert.equal(r.res.statusCode, 403);
    assert.equal(r.calls.length, 0);
  });
});

test('session reads and parses the body from the stream when req.body is absent', async () => {
  await withEnv(SESSION_ENV, async () => {
    const { Readable } = await import('node:stream');
    const req = Readable.from([Buffer.from(JSON.stringify({ turnstileToken: 'cf-stream' }))]);
    req.method = 'POST';
    req.headers = {};
    const r = await runSession({ req });
    assert.equal(r.res.statusCode, 200);
    assert.equal(new URLSearchParams(r.calls[0].init.body).get('response'), 'cf-stream');
  });
});

test('session returns 429 daily_limit_reached when 20 grants exist, and 19 still passes', async () => {
  await withEnv(SESSION_ENV, async () => {
    const full = await runSession({ count: 20 });
    assert.equal(full.res.statusCode, 429);
    assert.deepEqual(full.json, { error: 'daily_limit_reached' });
    assert.equal((await runSession({ count: 19 })).res.statusCode, 200);
  });
});

test('session honours LAVA_DAILY_LIMIT', async () => {
  await withEnv({ ...SESSION_ENV, LAVA_DAILY_LIMIT: '3' }, async () => {
    assert.equal((await runSession({ count: 3 })).res.statusCode, 429);
    assert.equal((await runSession({ count: 2 })).res.statusCode, 200);
  });
});

test('session returns 429 before calling ElevenLabs and records nothing', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession({ count: 20 });
    assert.equal(hitsEleven(r.calls), false);
    assert.equal(grantPosts(r.calls).length, 0);
  });
});

test('session fails closed when the quota count is unavailable', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession({ count: new Error('supabase down') });
    assert.equal(r.res.statusCode, 503);
    assert.deepEqual(r.json, { error: 'service_unavailable' });
    assert.equal(hitsEleven(r.calls), false);
  });
  await withEnv({ ...SESSION_ENV, SUPABASE_URL: undefined }, async () => {
    const r = await runSession();
    assert.equal(r.res.statusCode, 503);
    assert.equal(hitsEleven(r.calls), false);
  });
});

test('session mints a token from /v1/convai/conversation/token with the api key in the header', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession();
    assert.equal(r.res.statusCode, 200);
    assert.deepEqual(r.json, { token: 'conv-token-1', agentId: 'agent_abc' });
    const call = r.calls.find((c) => c.url.includes('api.elevenlabs.io'));
    assert.equal(
      call.url,
      'https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent_abc',
    );
    assert.equal(call.init.method, 'GET');
    assert.equal(call.init.headers['xi-api-key'], 'xi-secret-key-123');
    const order = r.calls.map((c) =>
      c.url.includes('cloudflare') ? 'turnstile' : c.url.includes('elevenlabs') ? 'mint' : c.init.method,
    );
    assert.deepEqual(order, ['turnstile', 'HEAD', 'mint', 'POST']);
  });
});

test('session never puts ELEVENLABS_API_KEY in the response, even when ElevenLabs fails', async () => {
  await withEnv(SESSION_ENV, async () => {
    const ok = await runSession();
    assert.ok(!ok.res.body.includes('xi-secret-key-123'));
    assert.ok(!JSON.stringify(ok.res.headers).includes('xi-secret-key-123'));

    // An upstream that echoes the key back must not leak through either.
    const bad = await runSession({
      mint: (u, init) => json({ detail: `bad key ${init.headers['xi-api-key']}` }, 401),
    });
    assert.equal(bad.res.statusCode, 502);
    assert.deepEqual(bad.json, { error: 'token_unavailable' });
    assert.ok(!bad.res.body.includes('xi-secret-key-123'));
  });
});

test('session returns 502 and records nothing when ElevenLabs gives no token', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession({ mint: () => json({}) });
    assert.equal(r.res.statusCode, 502);
    assert.equal(grantPosts(r.calls).length, 0);
  });
});

test('session records a grant with a salted sha256 ip hash, not the raw ip', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession();
    const [post] = grantPosts(r.calls);
    assert.ok(!post.init.body.includes('203.0.113.9'));
    assert.equal(JSON.parse(post.init.body).ip_hash, sha('203.0.113.9'));
  });
});

test('session falls back to x-real-ip and passes the same address to Turnstile', async () => {
  await withEnv(SESSION_ENV, async () => {
    const req = fakeReq({ headers: { 'x-forwarded-for': undefined, 'x-real-ip': '198.51.100.4' } });
    const r = await runSession({ req });
    assert.equal(JSON.parse(grantPosts(r.calls)[0].init.body).ip_hash, sha('198.51.100.4'));
    assert.equal(new URLSearchParams(r.calls[0].init.body).get('remoteip'), '198.51.100.4');
  });
});

test('session still hands out the token when recording the grant fails', async () => {
  await withEnv(SESSION_ENV, async () => {
    const r = await runSession({ record: () => new Response(null, { status: 500 }) });
    assert.equal(r.res.statusCode, 200);
    assert.equal(r.json.token, 'conv-token-1');
  });
});

// --- availability.mjs (Task 7) ---

const AVAILABILITY_NOW = new Date('2026-10-19T08:00:00.000Z');

async function runAvailability({
  req = fakeReq({ headers: { 'x-lava-tool-secret': 'tool-secret' } }),
  busy = [],
  bookedPerDay = {},
  getBusyError,
} = {}) {
  const calls = [];
  const handler = createAvailabilityHandler({
    now: () => new Date(AVAILABILITY_NOW),
    getBusy: async (timeMin, timeMax) => {
      calls.push({ kind: 'busy', timeMin, timeMax });
      if (getBusyError) throw getBusyError;
      return busy;
    },
    countLavaEventsPerDay: async (timeMin, timeMax) => {
      calls.push({ kind: 'counts', timeMin, timeMax });
      return bookedPerDay;
    },
  });
  const res = fakeRes();
  await handler(req, res);
  return { res, calls, json: res.body ? JSON.parse(res.body) : undefined };
}

test('availability returns 401 without the tool secret', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runAvailability({ req: fakeReq() });
    assert.equal(r.res.statusCode, 401);
    assert.deepEqual(r.json, { error: 'unauthorized' });
    assert.equal(r.calls.length, 0);
  });
});

test('availability rejects a non-POST method before touching the calendar', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runAvailability({
      req: fakeReq({ method: 'GET', headers: { 'x-lava-tool-secret': 'tool-secret' } }),
    });
    assert.equal(r.res.statusCode, 405);
    assert.equal(r.res.headers.allow, 'POST');
    assert.equal(r.calls.length, 0);
  });
});

test('availability returns at most three slots and queries one shared calendar range', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runAvailability();
    assert.equal(r.res.statusCode, 200);
    assert.equal(r.json.slots.length, 3);
    assert.deepEqual(r.calls.map((call) => call.kind), ['busy', 'counts']);
    assert.equal(r.calls[0].timeMin, AVAILABILITY_NOW.toISOString());
    assert.equal(r.calls[0].timeMax, r.calls[1].timeMax);
    assert.equal(r.calls[0].timeMin, r.calls[1].timeMin);
  });
});

test('availability labels a slot in speakable Dutch with no year', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runAvailability();
    assert.deepEqual(r.json.slots[0], {
      start: '2026-10-20T10:00:00+02:00',
      label: 'dinsdag 20 oktober om 10:00',
    });
    assert.doesNotMatch(r.json.slots[0].label, /2026/);
  });
});

test('availability returns an empty array and no error when the next three weeks are full', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const bookedPerDay = Object.fromEntries(
      Array.from({ length: 23 }, (_, i) => {
        const day = new Date(Date.UTC(2026, 9, 19 + i));
        return [day.toISOString().slice(0, 10), 2];
      }),
    );
    const r = await runAvailability({ bookedPerDay });
    assert.equal(r.res.statusCode, 200);
    assert.deepEqual(r.json, { slots: [] });
  });
});

test('availability fails closed when the calendar cannot be read', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const r = await runAvailability({ getBusyError: new Error('calendar down') });
      assert.equal(r.res.statusCode, 503);
      assert.deepEqual(r.json, { error: 'calendar_unavailable' });
      assert.equal('slots' in r.json, false);
    } finally {
      console.error = originalError;
    }
  });
});

// --- book.mjs (Task 8) ---

const BOOK_NOW = new Date('2026-10-19T08:00:00.000Z');
const BOOK_BODY = {
  kind: 'intake',
  naam: 'Mark de Wit',
  email: 'mark@example.nl',
  uitdaging: 'Onze planning kost te veel handwerk.',
  startIso: '2026-10-20T10:00:00+02:00',
  conversationId: 'conv-123',
};

async function runBook({
  req,
  body = BOOK_BODY,
  busy = [],
  claimResult = true,
  claimError,
  insertError,
  insertedResult,
} = {}) {
  const calls = [];
  const handler = createBookHandler({
    now: () => new Date(BOOK_NOW),
    getBusy: async (timeMin, timeMax) => {
      calls.push({ kind: 'busy', timeMin, timeMax });
      return busy;
    },
    createStoreClient: () => ({ kind: 'fake-store' }),
    claimBookingSlot: async (startIso, claimToken, store) => {
      calls.push({ kind: 'claim', startIso, claimToken, store });
      if (claimError) throw claimError;
      return claimResult;
    },
    insertEvent: async (event) => {
      calls.push({ kind: 'insert', event });
      if (insertError) throw insertError;
      return insertedResult ?? {
        id: 'evt-123',
        htmlLink: 'https://calendar.google.com/event?eid=evt-123',
        meetUrl: event.withMeet ? 'https://meet.google.com/abc-defg-hij' : undefined,
      };
    },
  });
  const actualReq = req ?? fakeReq({
    body,
    headers: { 'x-lava-tool-secret': 'tool-secret' },
  });
  const res = fakeRes();
  await handler(actualReq, res);
  return { res, calls, json: res.body ? JSON.parse(res.body) : undefined };
}

const inserts = (calls) => calls.filter((call) => call.kind === 'insert');

test('book returns 401 without the tool secret', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runBook({ req: fakeReq({ body: BOOK_BODY }) });
    assert.equal(r.res.statusCode, 401);
    assert.deepEqual(r.json, { ok: false, reason: 'unauthorized' });
    assert.equal(r.calls.length, 0);
  });
});

test('book refuses kind=callback without telefoon with phone_required', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runBook({ body: { ...BOOK_BODY, kind: 'callback' } });
    assert.equal(r.res.statusCode, 400);
    assert.deepEqual(r.json, { ok: false, reason: 'phone_required' });
    assert.equal(r.calls.length, 0);
  });
});

test('book refuses a missing naam, email or uitdaging with missing_field', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    for (const field of ['naam', 'email', 'uitdaging']) {
      const r = await runBook({ body: { ...BOOK_BODY, [field]: '  ' } });
      assert.equal(r.res.statusCode, 400, field);
      assert.deepEqual(r.json, { ok: false, reason: 'missing_field' }, field);
      assert.equal(r.calls.length, 0, field);
    }
  });
});

test('book rejects an invalid email and incomplete booking identity before calendar I/O', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    for (const body of [
      { ...BOOK_BODY, email: 'geen-email' },
      { ...BOOK_BODY, startIso: '' },
      { ...BOOK_BODY, conversationId: '' },
      { ...BOOK_BODY, kind: 'other' },
    ]) {
      const r = await runBook({ body });
      assert.equal(r.res.statusCode, 400);
      assert.deepEqual(r.json, { ok: false, reason: 'missing_field' });
      assert.equal(r.calls.length, 0);
    }
  });
});

test('book re-checks freebusy and returns 409 slot_taken when the slot filled since the offer', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runBook({
      busy: [{ start: '2026-10-20T08:10:00.000Z', end: '2026-10-20T08:20:00.000Z' }],
    });
    assert.equal(r.res.statusCode, 409);
    assert.deepEqual(r.json, { ok: false, reason: 'slot_taken' });
    assert.equal(inserts(r.calls).length, 0);
    assert.deepEqual(r.calls[0], {
      kind: 'busy',
      timeMin: '2026-10-20T08:00:00.000Z',
      timeMax: '2026-10-20T08:30:00.000Z',
    });
  });
});

test('book maps an insert collision to slot_taken when another request wins the race', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const collision = Object.assign(new Error('already exists'), { name: 'GoogleApiError', status: 409 });
    const r = await runBook({ insertError: collision });
    assert.equal(r.res.statusCode, 409);
    assert.deepEqual(r.json, { ok: false, reason: 'slot_taken' });
  });
});

test('book uses an atomic store claim so concurrent Vercel instances cannot both insert', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runBook({ claimResult: false });
    assert.equal(r.res.statusCode, 409);
    assert.deepEqual(r.json, { ok: false, reason: 'slot_taken' });
    assert.equal(inserts(r.calls).length, 0);
    const claim = r.calls.find((call) => call.kind === 'claim');
    assert.equal(claim.startIso, BOOK_BODY.startIso);
    assert.match(claim.claimToken, /^[0-9a-f-]{36}$/);
    assert.deepEqual(r.calls.map((call) => call.kind), ['busy', 'claim']);
  });
});

test('book fails closed when the distributed slot claim is unavailable', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const r = await runBook({ claimError: new Error('store down') });
      assert.equal(r.res.statusCode, 503);
      assert.deepEqual(r.json, { ok: false, reason: 'calendar_unavailable' });
      assert.equal(inserts(r.calls).length, 0);
    } finally {
      console.error = originalError;
    }
  });
});

test('book titles an intake event and requests a Meet link', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runBook();
    const event = inserts(r.calls)[0].event;
    assert.equal(event.summary, 'LAVA intake — Mark de Wit');
    assert.equal(event.withMeet, true);
    assert.match(event.id, /^lava[0-9a-f]+$/);
    assert.equal(r.res.statusCode, 200);
  });
});

test('book titles a callback event, includes the phone number and does not request Meet', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runBook({
      body: { ...BOOK_BODY, kind: 'callback', telefoon: '+31 6 12345678' },
    });
    const event = inserts(r.calls)[0].event;
    assert.equal(event.summary, 'Terugbelverzoek — Mark de Wit');
    assert.match(event.description, /\+31 6 12345678/);
    assert.equal(event.withMeet, false);
  });
});

test('book propagates validateSlot rejections without calling insertEvent', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runBook({ body: { ...BOOK_BODY, startIso: '2026-10-19T10:30:00+02:00' } });
    assert.equal(r.res.statusCode, 400);
    assert.deepEqual(r.json, { ok: false, reason: 'too_soon' });
    assert.equal(r.calls.length, 0);
  });
});

test('book returns icsText containing the booked start time and visitor invitation', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'tool-secret' }, async () => {
    const r = await runBook();
    assert.equal(r.res.statusCode, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.startIso, BOOK_BODY.startIso);
    assert.equal(r.json.label, 'dinsdag 20 oktober om 10:00');
    assert.match(r.json.icsText, /DTSTART:20261020T080000Z\r\n/);
    assert.match(r.json.icsText, /ATTENDEE:mailto:mark@example\.nl\r\n/);
    assert.match(r.json.icsText, /Google Meet: https:\/\/meet\.google\.com\/abc-defg-hij/);
  });
});
