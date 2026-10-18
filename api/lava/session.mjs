// POST /api/lava/session: the only place a LAVA conversation can be refused.
// Order is deliberate and tested: method, Turnstile, daily ceiling, mint, record.
// A refusal happens before ElevenLabs is called, so a bot or a full day spends
// no voice credits. The ElevenLabs API key stays in this file; the browser only
// ever receives a short-lived conversation token.

import { createHash } from 'node:crypto';

import { verifyTurnstile } from './_lib/guards.mjs';
import { countSessionsToday, createStoreClient, recordSessionGrant } from './_lib/store.mjs';

const TOKEN_URL = 'https://api.elevenlabs.io/v1/convai/conversation/token';
const DEFAULT_DAILY_LIMIT = 20;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// Vercel parses JSON bodies into req.body; fall back to the raw stream otherwise.
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

function clientIp(req) {
  const first = (value) => {
    const v = Array.isArray(value) ? value[0] : value;
    return typeof v === 'string' ? v.split(',')[0].trim() : '';
  };
  return (
    first(req.headers?.['x-forwarded-for']) ||
    first(req.headers?.['x-real-ip']) ||
    req.socket?.remoteAddress ||
    ''
  );
}

// The store persists whatever it is given, so the raw IP must never get that far.
function hashIp(ip) {
  return createHash('sha256')
    .update(ip + (process.env.LAVA_TOOL_SECRET ?? ''))
    .digest('hex');
}

function dailyLimit() {
  const n = Number.parseInt(process.env.LAVA_DAILY_LIMIT ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_LIMIT;
}

// Returns the token string, or null for any failure. Nothing from the upstream
// response is passed on: it could echo the key back.
async function mintToken(agentId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !agentId) return null;
  try {
    const res = await fetch(`${TOKEN_URL}?agent_id=${encodeURIComponent(agentId)}`, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.token === 'string' && data.token !== '' ? data.token : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const { turnstileToken } = await readBody(req);
  const ip = clientIp(req);

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return sendJson(res, 403, { error: 'bot_check_failed' });
  }

  // Fail closed: if the count cannot be read, the cap cannot be enforced, so refuse.
  let store;
  try {
    store = createStoreClient();
    if ((await countSessionsToday(new Date(), store)) >= dailyLimit()) {
      return sendJson(res, 429, { error: 'daily_limit_reached' });
    }
  } catch (err) {
    console.error('lava session: quota check unavailable:', err.message);
    return sendJson(res, 503, { error: 'service_unavailable' });
  }

  const agentId = process.env.LAVA_AGENT_ID;
  const token = await mintToken(agentId);
  if (!token) {
    console.error('lava session: could not mint a conversation token');
    return sendJson(res, 502, { error: 'token_unavailable' });
  }

  // The conversation already exists, so a failed record must not take it away.
  // The cost is one uncounted conversation, which the soft ceiling tolerates.
  try {
    await recordSessionGrant(new Date(), hashIp(ip), store);
  } catch (err) {
    console.error('lava session: grant not recorded:', err.message);
  }

  return sendJson(res, 200, { token, agentId });
}
