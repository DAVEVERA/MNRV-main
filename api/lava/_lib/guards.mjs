// Request guards for LAVA: who may start a conversation and who may call the tools.
// Both return booleans on purpose: a guard that cannot decide must say "no".

import { createHash, timingSafeEqual } from 'node:crypto';

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function headerValue(req, name) {
  const headers = req?.headers;
  if (!headers) return undefined;
  const value = typeof headers.get === 'function' ? headers.get(name) : headers[name];
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

// Hashing first gives two equal-length buffers, so timingSafeEqual never throws
// and the secret length does not leak through an early return.
function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

/** Whether the request carries the agent's tool secret (header x-lava-tool-secret). */
export function verifyToolAuth(req) {
  const secret = process.env.LAVA_TOOL_SECRET;
  const given = headerValue(req, 'x-lava-tool-secret');
  if (!secret || typeof given !== 'string' || given === '') return false;
  return timingSafeEqual(digest(given), digest(secret));
}

/** Whether Cloudflare Turnstile accepts the token. Any failure to ask means no. */
export async function verifyTurnstile(token, ip, fetchImpl = fetch) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== 'string' || token === '') return false;
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set('remoteip', ip);
    const res = await fetchImpl(TURNSTILE_URL, { method: 'POST', body: form });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}
