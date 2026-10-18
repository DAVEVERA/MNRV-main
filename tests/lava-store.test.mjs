import assert from 'node:assert/strict';
import test from 'node:test';

import { localDateKey } from '../api/lava/_lib/rules.mjs';
import {
  claimReport,
  countSessionsToday,
  createStoreClient,
  recordSessionGrant,
} from '../api/lava/_lib/store.mjs';

// Fake Supabase REST: a client whose fetch records calls and answers via `handler`.
function fakeClient(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    return handler(call);
  };
  const client = createStoreClient({
    url: 'https://proj.supabase.co',
    serviceRoleKey: 'service-key',
    fetchImpl,
  });
  return { client, calls };
}

test('createStoreClient sends the service-role key and refuses to run unconfigured', async () => {
  const { client, calls } = fakeClient(() => new Response('[]', { status: 200 }));
  await client.request('/rest/v1/x');
  assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/x');
  assert.equal(calls[0].init.headers.apikey, 'service-key');
  assert.equal(calls[0].init.headers.authorization, 'Bearer service-key');
  assert.throws(() => createStoreClient({ url: '', serviceRoleKey: '' }), /SUPABASE/);
});

test('the Amsterdam day key used for counting is the local day for 23:30 UTC in summer', () => {
  // 23:30 UTC on 14 July is 01:30 on the 15th in Amsterdam (UTC+2).
  assert.equal(localDateKey(new Date('2026-07-14T23:30:00Z')), '2026-07-15');
  // 22:30 UTC in winter is still 23:30 on the same day (UTC+1).
  assert.equal(localDateKey(new Date('2026-01-14T22:30:00Z')), '2026-01-14');
});

test('the Amsterdam day key used for counting is the local day across the DST change', () => {
  // DST ends Sunday 25 October 2026 at 01:00 UTC.
  assert.equal(localDateKey(new Date('2026-10-24T22:30:00Z')), '2026-10-25');
  assert.equal(localDateKey(new Date('2026-10-25T00:30:00Z')), '2026-10-25');
  assert.equal(localDateKey(new Date('2026-10-25T23:30:00Z')), '2026-10-26');
});

test('countSessionsToday filters on the Amsterdam day key, not UTC', async () => {
  const { client, calls } = fakeClient(
    () => new Response(null, { status: 206, headers: { 'content-range': '0-0/7' } }),
  );
  // 23:30 UTC on 14 July is already the 15th in Amsterdam.
  const count = await countSessionsToday(new Date('2026-07-14T23:30:00Z'), client);
  assert.equal(count, 7);

  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/rest/v1/lava_session_grants');
  assert.equal(url.searchParams.get('day_key'), 'eq.2026-07-15');
  assert.equal(calls[0].init.method, 'HEAD');
  assert.equal(calls[0].init.headers.prefer, 'count=exact');
});

test('countSessionsToday reads an empty day and throws on an unreadable answer', async () => {
  const empty = fakeClient(() => new Response(null, { status: 200, headers: { 'content-range': '*/0' } }));
  assert.equal(await countSessionsToday(new Date('2026-07-14T10:00:00Z'), empty.client), 0);

  const noHeader = fakeClient(() => new Response(null, { status: 200 }));
  await assert.rejects(countSessionsToday(new Date(), noHeader.client), /content-range/i);

  const down = fakeClient(() => new Response('nope', { status: 500 }));
  await assert.rejects(countSessionsToday(new Date(), down.client), /500/);
});

test('recordSessionGrant inserts the Amsterdam day key and the ip hash', async () => {
  const { client, calls } = fakeClient(() => new Response(null, { status: 201 }));
  await recordSessionGrant(new Date('2026-07-14T23:30:00Z'), 'hash-abc', client);

  assert.equal(new URL(calls[0].url).pathname, '/rest/v1/lava_session_grants');
  assert.equal(calls[0].init.method, 'POST');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.day_key, '2026-07-15');
  assert.equal(body.ip_hash, 'hash-abc');
  assert.equal(body.granted_at, '2026-07-14T23:30:00.000Z');

  const down = fakeClient(() => new Response('nope', { status: 500 }));
  await assert.rejects(recordSessionGrant(new Date(), 'h', down.client), /500/);
});

test('claimReport returns true once and false for the same conversation id', async () => {
  const claimed = new Set();
  const { client, calls } = fakeClient((call) => {
    const { conversation_id: id } = JSON.parse(call.init.body);
    if (claimed.has(id)) return new Response('{"code":"23505"}', { status: 409 });
    claimed.add(id);
    return new Response(null, { status: 201 });
  });

  assert.equal(await claimReport('conv_1', client), true);
  assert.equal(await claimReport('conv_1', client), false);
  assert.equal(await claimReport('conv_2', client), true);

  // A plain insert: with resolution=ignore the conflict would be swallowed.
  assert.equal(new URL(calls[0].url).pathname, '/rest/v1/lava_reports');
  assert.equal(calls[0].init.method, 'POST');
  assert.doesNotMatch(calls[0].init.headers.prefer ?? '', /resolution/);
  assert.equal(calls.length, 3);
});

test('claimReport throws on any other failure instead of claiming or refusing', async () => {
  const { client } = fakeClient(() => new Response('nope', { status: 500 }));
  await assert.rejects(claimReport('conv_1', client), /500/);
  await assert.rejects(claimReport('', client), /conversation/i);
});
