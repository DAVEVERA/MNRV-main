// ElevenLabs post-call webhook: the server-side safety net.
//
// LAVA writes his own report in a tool call when he wraps up. If the visitor
// closes the window instead, that call never happens and half a conversation
// would vanish without a trace. This endpoint rebuilds the report from the
// transcript afterwards.
//
// It claims BEFORE extracting, for two reasons: a conversation LAVA already
// reported must not be mailed twice (Review Focus 1), and the claim check is
// free while the extraction is a Claude call. If anything after the claim
// fails, the claim is released so the lead is not lost in silence.
//
// Signature: ElevenLabs sends `ElevenLabs-Signature: t=<unix>,v0=<hex>` where
// the HMAC covers `<t>.<raw body>`. The plan said "HMAC over the raw body";
// that would not verify a real delivery, so this follows the wire format.

import { createHmac, timingSafeEqual } from 'node:crypto';

import { deliverReport } from './report.mjs';
import { claimReport, createStoreClient, releaseReport } from './_lib/store.mjs';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const EXTRACTION_MODEL = 'claude-sonnet-4-5';
// A replayed delivery outside this window is refused.
const TOLERANCE_SECONDS = 30 * 60;

// Every field normalizeReport reads. The model is told to return strings only;
// this is the second line of defence.
const STRING_FIELDS = [
  'naam',
  'email',
  'telefoon',
  'label',
  'uitdaging',
  'beoogde_oplossing',
  'verwachting',
  'gespreksdoel',
  'uitkomst',
  'follow_up',
];

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/** The raw bytes, untouched: parsing first would change what we verify. */
async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
  }
  // An already-parsed object cannot be verified byte-for-byte; re-serialising
  // would compare a different string than the one that was signed.
  return req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : '';
}

export function verifyWebhookSignature(rawBody, header, secret, now = new Date()) {
  if (!secret || typeof header !== 'string') return false;
  const parts = Object.fromEntries(
    header
      .split(',')
      .map((piece) => piece.trim().split('='))
      .filter((pair) => pair.length === 2),
  );
  const timestamp = Number(parts.t);
  const provided = parts.v0;
  if (!Number.isFinite(timestamp) || typeof provided !== 'string') return false;

  const ageSeconds = Math.abs(Math.floor(now.getTime() / 1000) - timestamp);
  if (ageSeconds > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  // Hash both sides so the comparison is length-safe.
  const a = createHmac('sha256', secret).update(expected).digest();
  const b = createHmac('sha256', secret).update(provided).digest();
  return timingSafeEqual(a, b);
}

/** Turns the webhook's turn list into the plain text the extractor reads. */
export function transcriptToText(transcript) {
  if (typeof transcript === 'string') return transcript;
  if (!Array.isArray(transcript)) return '';
  return transcript
    .map((turn) => {
      const who = turn?.role === 'user' ? 'Bezoeker' : 'LAVA';
      const said = typeof turn?.message === 'string' ? turn.message : '';
      return said ? `${who}: ${said}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

const EXTRACTION_PROMPT = `Je krijgt het transcript van een intakegesprek van MNRV.
Haal hieruit de feiten en geef ALLEEN geldige JSON terug, zonder uitleg eromheen.

Vorm:
{
  "naam": string,
  "email": string,
  "telefoon": string,
  "label": "binnen_de_lijnen" | "buiten_de_lijnen" | "student" | "recruiter" | "bestaande_klant",
  "uitdaging": string,
  "beoogde_oplossing": string,
  "verwachting": string,
  "gespreksdoel": string,
  "uitkomst": string,
  "follow_up": string,
  "vervolgactie": { "wat": string }
}

Regels:
- Elke waarde is een string. Nooit een lijst, een getal, null of een object (behalve vervolgactie).
- Staat iets niet in het gesprek, laat het veld dan WEG. Verzin niets.
- Schrijf in het Nederlands.`;

/**
 * One Claude call that turns a transcript into the Report shape.
 * Exported for the test; the handler injects it.
 */
export async function extractReport(transcriptText, fetchImpl = fetch) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY must be set');

  const res = await fetchImpl(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      max_tokens: 2000,
      messages: [
        { role: 'user', content: `${EXTRACTION_PROMPT}\n\nTranscript:\n${transcriptText}` },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude refused the extraction with status ${res.status}`);
  }
  const payload = await res.json();
  const text = (payload?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude returned no JSON object for the report');

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('Claude returned unparseable JSON for the report');
  }

  // Keep only strings; normalizeReport would silently drop the rest anyway and
  // the owner would read "Niet aan de orde gekomen" for something that was said.
  const report = {};
  for (const key of STRING_FIELDS) {
    if (typeof parsed[key] === 'string' && parsed[key].trim() !== '') report[key] = parsed[key];
  }
  if (parsed.vervolgactie && typeof parsed.vervolgactie === 'object') {
    const wat = parsed.vervolgactie.wat;
    if (typeof wat === 'string' && wat.trim() !== '') report.vervolgactie = { wat };
  }
  return report;
}

export function createPostCallHandler({
  now = () => new Date(),
  createStoreClient: createStoreClientImpl = createStoreClient,
  claimReport: claimReportImpl = claimReport,
  releaseReport: releaseReportImpl = releaseReport,
  extractReport: extractReportImpl = extractReport,
  deliverReport: deliverReportImpl = deliverReport,
  sendMail: sendMailImpl,
} = {}) {
  return async function postCallHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, reason: 'method_not_allowed' });
    }

    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (!secret) {
      console.error('lava post-call: ELEVENLABS_WEBHOOK_SECRET is not set');
      return sendJson(res, 503, { ok: false, reason: 'not_configured' });
    }

    const rawBody = await readRawBody(req);
    const header = req.headers?.['elevenlabs-signature'] || req.headers?.['ElevenLabs-Signature'];
    if (!verifyWebhookSignature(rawBody, header, secret, now())) {
      return sendJson(res, 401, { ok: false, reason: 'bad_signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return sendJson(res, 400, { ok: false, reason: 'unparseable_body' });
    }

    const data = payload?.data || {};
    const conversationId = typeof data.conversation_id === 'string' ? data.conversation_id : '';
    if (!conversationId) {
      return sendJson(res, 400, { ok: false, reason: 'missing_conversation_id' });
    }

    const transcriptText = transcriptToText(data.transcript);
    if (!transcriptText) {
      return sendJson(res, 200, { ok: true, mailed: false, reason: 'empty_transcript' });
    }

    let store;
    try {
      store = createStoreClientImpl();
    } catch (err) {
      console.error('lava post-call: store unavailable:', err.message);
      return sendJson(res, 503, { ok: false, reason: 'store_unavailable' });
    }

    let won;
    try {
      won = await claimReportImpl(conversationId, store);
    } catch (err) {
      console.error('lava post-call: claim failed:', err.message);
      return sendJson(res, 503, { ok: false, reason: 'store_unavailable' });
    }
    if (!won) {
      // LAVA's own tool call already delivered this conversation.
      return sendJson(res, 200, { ok: true, mailed: false, reason: 'already_sent' });
    }

    let extracted;
    try {
      extracted = await extractReportImpl(transcriptText);
    } catch (err) {
      console.error('lava post-call: extraction failed:', err.message);
      await releaseClaim(releaseReportImpl, conversationId, store);
      return sendJson(res, 502, { ok: false, reason: 'extraction_failed' });
    }

    // The ending is ours to set, not the model's: this report IS a
    // reconstruction however confidently the transcript reads.
    const report = { ...extracted, transcript: transcriptText, ending: 'fallback' };

    try {
      const { status, payload: result } = await deliverReportImpl(
        // No appointment: this path never books, so there is no invitation.
        { conversationId, report },
        {
          now,
          createStoreClient: () => store,
          claimReport: claimReportImpl,
          releaseReport: releaseReportImpl,
          claimed: true,
          ...(sendMailImpl ? { sendMail: sendMailImpl } : {}),
        },
      );
      if (status >= 400) await releaseClaim(releaseReportImpl, conversationId, store);
      return sendJson(res, status, result);
    } catch (err) {
      console.error('lava post-call: delivery failed:', err.message);
      await releaseClaim(releaseReportImpl, conversationId, store);
      return sendJson(res, 502, { ok: false, reason: 'delivery_failed' });
    }
  };
}

async function releaseClaim(releaseReportImpl, conversationId, store) {
  try {
    await releaseReportImpl(conversationId, store);
  } catch (err) {
    console.error('lava post-call: releasing the claim failed:', err.message);
  }
}

export default createPostCallHandler();
