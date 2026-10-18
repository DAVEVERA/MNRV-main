// Session grants and report claims, kept in Supabase over its REST endpoint.
// No SDK: the project has no build step. Every failure throws, because a silent
// default here would mean "nobody has used their quota" or "report not yet sent".

import { localDateKey } from './rules.mjs';

/**
 * The seam the store functions (and their tests) use.
 * `request(path, init)` -> Response, with the Supabase base URL and the
 * service-role key applied. Defaults come from SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY.
 */
export function createStoreClient({
  url = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
} = {}) {
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  const base = url.replace(/\/+$/, '');
  return {
    request(path, init = {}) {
      return fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          'content-type': 'application/json',
          ...init.headers,
        },
      });
    },
  };
}

/** Number of sessions granted on the Amsterdam calendar day of `now`. */
export async function countSessionsToday(now, clientImpl) {
  const dayKey = localDateKey(now);
  const res = await clientImpl.request(
    `/rest/v1/lava_session_grants?select=id&day_key=eq.${encodeURIComponent(dayKey)}`,
    { method: 'HEAD', headers: { prefer: 'count=exact' } },
  );
  if (!res.ok) throw new Error(`Counting sessions failed with status ${res.status}`);
  const range = res.headers.get('content-range') ?? '';
  const match = /\/(\d+)$/.exec(range);
  if (!match) throw new Error(`Unreadable content-range header: ${JSON.stringify(range)}`);
  return Number(match[1]);
}

/** Records one granted session against the Amsterdam day of `now`. */
export async function recordSessionGrant(now, ipHash, clientImpl) {
  const res = await clientImpl.request('/rest/v1/lava_session_grants', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({
      granted_at: now.toISOString(),
      day_key: localDateKey(now),
      ip_hash: ipHash,
    }),
  });
  if (!res.ok) throw new Error(`Recording the session grant failed with status ${res.status}`);
}

/**
 * True only for the first caller per conversation id. The primary key decides:
 * a duplicate insert answers 409, so two concurrent callers cannot both win.
 */
export async function claimReport(conversationId, clientImpl) {
  if (typeof conversationId !== 'string' || conversationId === '') {
    throw new TypeError('claimReport needs a conversation id');
  }
  const res = await clientImpl.request('/rest/v1/lava_reports', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({
      conversation_id: conversationId,
      claimed_at: new Date().toISOString(),
    }),
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`Claiming the report failed with status ${res.status}`);
  return true;
}
