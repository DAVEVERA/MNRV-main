// ElevenLabs tool endpoint for LAVA's one deliverable: the owner's report.
// Dave gets the eight sections plus the .ics; the visitor gets only the
// invitation, never the transcript or the lead label.
//
// Order matters. The claim is taken BEFORE mailing, so LAVA's own tool call and
// the post-call fallback cannot both deliver (Review Focus 1). If the owner's
// mail then fails, the claim is released so the fallback can still try — the
// one outcome this project cannot absorb is a lead that silently vanishes.
// The visitor's mail is sent last and its failure is swallowed: a typo'd
// address must not cost Dave the lead (Review Focus 5).

import { icsUidForSlot } from './_lib/appointment.mjs';
import { verifyToolAuth } from './_lib/guards.mjs';
import { buildIcs } from './_lib/ics.mjs';
import { sendMail } from './_lib/mail.mjs';
import { normalizeReport, renderReportHtml, renderReportText } from './_lib/report.mjs';
import { claimReport, createStoreClient, releaseReport } from './_lib/store.mjs';

const ICS_FILENAME = 'afspraak.ics';

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

const adminEmail = () => process.env.INTAKE_ADMIN_EMAIL || 'info@mnrv.nl';

// Dave sorts his inbox by subject; a reconstruction must say so there too,
// not only in the body note the renderers add.
function subjectFor(report) {
  return report.ending === 'fallback'
    ? `LAVA intake (achteraf samengesteld) — ${report.naam}`
    : `LAVA intake — ${report.naam}`;
}

function icsFor(appointment, report, now) {
  return buildIcs(
    {
      uid: icsUidForSlot(appointment.startIso),
      startIso: appointment.startIso,
      endIso: appointment.endIso,
      summary: appointment.summary,
      description: appointment.description,
      organizerEmail: adminEmail(),
      attendeeEmail: report.email,
      meetUrl: appointment.meetUrl,
    },
    now,
  );
}

// Dutch, and deliberately free of anything from the report body.
function visitorHtml(report, meetUrl) {
  const lines = [
    `<p>Hoi ${escapeHtml(report.naam)},</p>`,
    '<p>Je afspraak met MNRV staat genoteerd. De uitnodiging zit als bijlage bij deze mail.</p>',
  ];
  if (meetUrl) lines.push(`<p>Google Meet: <a href="${escapeHtml(meetUrl)}">${escapeHtml(meetUrl)}</a></p>`);
  lines.push('<p>Tot dan!</p>', '<p>— MNRV</p>');
  return lines.join('\n');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Composes and delivers one conversation's report. Exported so the post-call
 * fallback (Task 10) reuses this exact path instead of duplicating it — two
 * implementations would drift and Dave would get two differently shaped mails.
 *
 * @returns {Promise<{ status: number, payload: object }>}
 */
export async function deliverReport(
  { conversationId, report: rawReport, appointment },
  {
    now = () => new Date(),
    createStoreClient: createStoreClientImpl = createStoreClient,
    claimReport: claimReportImpl = claimReport,
    releaseReport: releaseReportImpl = releaseReport,
    sendMail: sendMailImpl = sendMail,
    // The post-call fallback claims first so a conversation LAVA already
    // reported never costs an extraction call; it then passes the claim in.
    claimed = false,
  } = {},
) {
  if (typeof conversationId !== 'string' || conversationId.trim() === '') {
    return { status: 400, payload: { ok: false, missing: ['conversationId'] } };
  }
  const normalized = normalizeReport(rawReport);
  if (!normalized.ok) {
    return { status: 400, payload: { ok: false, missing: normalized.missing } };
  }
  const report = normalized.report;
  const current = now();

  const store = createStoreClientImpl();
  const won = claimed || (await claimReportImpl(conversationId, store));
  if (!won) {
    return { status: 200, payload: { ok: true, mailed: false, reason: 'already_sent' } };
  }

  const hasAppointment = Boolean(appointment && appointment.startIso && appointment.endIso);
  const icsText = hasAppointment ? icsFor(appointment, report, current) : undefined;
  const attachments = icsText
    ? [{ filename: ICS_FILENAME, content: Buffer.from(icsText, 'utf8').toString('base64') }]
    : [];

  try {
    await sendMailImpl({
      to: [adminEmail()],
      subject: subjectFor(report),
      html: renderReportHtml(report),
      text: renderReportText(report),
      attachments,
    });
  } catch (err) {
    console.error('lava report: owner mail failed:', err.message);
    try {
      await releaseReportImpl(conversationId, store);
    } catch (releaseErr) {
      // The send failure is the one worth reporting; log and keep it.
      console.error('lava report: releasing the claim also failed:', releaseErr.message);
    }
    return { status: 502, payload: { ok: false, reason: 'mail_failed' } };
  }

  if (hasAppointment) {
    try {
      await sendMailImpl({
        to: [report.email],
        subject: 'Je afspraak met MNRV',
        html: visitorHtml(report, appointment.meetUrl),
        attachments,
      });
    } catch (err) {
      // Deliberately swallowed: Dave already has the lead.
      console.error('lava report: visitor mail failed:', err.message);
    }
  }

  return { status: 200, payload: { ok: true, mailed: true } };
}

export function createReportHandler(deps = {}) {
  return async function reportHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, reason: 'method_not_allowed' });
    }
    if (!verifyToolAuth(req)) {
      return sendJson(res, 401, { ok: false, reason: 'unauthorized' });
    }
    const body = await readBody(req);
    try {
      const { status, payload } = await deliverReport(body, deps);
      return sendJson(res, status, payload);
    } catch (err) {
      console.error('lava report: unavailable:', err.message);
      return sendJson(res, 503, { ok: false, reason: 'report_unavailable' });
    }
  };
}

export default createReportHandler();
