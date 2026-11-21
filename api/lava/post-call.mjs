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
import { LEAD_LABELS } from './_lib/report.mjs';
import { claimReport, createStoreClient, releaseReport } from './_lib/store.mjs';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const EXTRACTION_MODEL = 'claude-sonnet-4-5';
// A replayed delivery outside this window is refused.
const TOLERANCE_SECONDS = 30 * 60;
// A signer whose clock runs slightly fast is tolerated; an hour ahead is not.
const CLOCK_SKEW_SECONDS = 60;

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

const usable = (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/**
 * The exact bytes that were signed.
 *
 * Order matters and is not obvious. On Vercel's Node runtime an
 * application/json body is parsed into `req.body` BEFORE the handler runs, and
 * `req` is an IncomingMessage, which is always async-iterable. So a
 * stream-first reader drains nothing, returns '' and fails every genuine
 * delivery. The explicitly captured raw body is checked first, then the
 * stream, and the parsed object is the last resort.
 */
async function readRawBody(req) {
  // Web Request (Vercel's Web handler signature): the body is untouched.
  if (typeof req?.text === 'function') return req.text();

  // Some runtimes keep the original bytes beside the parsed value.
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');

  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');

  // Unparsed stream: read it.
  if (typeof req[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (chunks.length > 0) return Buffer.concat(chunks).toString('utf8');
  }

  // Last resort: the body was parsed and the bytes are gone. Re-serialising is
  // not byte-exact in general, so this is a best effort rather than a
  // guarantee; see VERIFIED_SHAPES in docs/lava-agent-config.md.
  return req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : '';
}

function headerValue(req, name) {
  const headers = req?.headers;
  if (!headers) return undefined;
  // A Web Request carries a Headers object; Node lower-cases its keys.
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  return headers[name] ?? headers[name.toLowerCase()];
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

  const nowSeconds = Math.floor(now.getTime() / 1000);
  // Late deliveries happen; deliveries from the future do not.
  if (timestamp - nowSeconds > CLOCK_SKEW_SECONDS) return false;
  if (nowSeconds - timestamp > TOLERANCE_SECONDS) return false;

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
    const header = headerValue(req, 'elevenlabs-signature');
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
    //
    // normalizeReport hard-requires naam, email, uitdaging and label, and the
    // extraction prompt is told to omit whatever was not said. LAVA asks for a
    // name and an address late, so the conversations this net exists for -- the
    // ones that stopped early -- are exactly the ones missing those fields.
    // Refusing them would make the net a no-op, so the gaps are named instead.
    // Safe here: this path never has an appointment, so no invitation and no
    // visitor mail is built from these placeholders, and the transcript is
    // always attached for Dave to read.
    const report = {
      ...extracted,
      naam: usable(extracted.naam) || 'Onbekende bezoeker',
      email: usable(extracted.email) || 'onbekend',
      uitdaging: usable(extracted.uitdaging) || '(niet expliciet benoemd)',
      label: LEAD_LABELS.includes(extracted.label) ? extracted.label : 'buiten_de_lijnen',
      transcript: transcriptText,
      ending: 'fallback',
    };

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
      // deliverReport releases the claim itself on its own failure path, so a
      // second release here could free a claim a concurrent send_report has
      // since taken, and both paths would mail.
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
