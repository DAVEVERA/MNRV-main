// --- google.mjs (Task 4) ---
import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import {
  countLavaEventsPerDay,
  getAccessToken,
  getBusy,
  insertEvent,
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
];

// Runs fn with a controlled Google environment, then restores the previous one.
async function withEnv(overrides, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'lava@proj.iam.gserviceaccount.com',
    // Vercel stores the key on one line with literal backslash-n sequences.
    GOOGLE_PRIVATE_KEY: privateKey.replace(/\n/g, '\n'),
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
