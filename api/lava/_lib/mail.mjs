// Resend transport for LAVA's two outgoing mails: the owner's report and the
// visitor's invitation. Mirrors api/send-intake-mail.js (CommonJS, so it cannot
// be imported here) and adds attachment support for the .ics.
// Every failure throws: the report endpoint releases its idempotency claim on a
// throw, so a swallowed error here would silently lose a lead.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * @param {{ to: string[], subject: string, html: string, text?: string,
 *           attachments?: Array<{ filename: string, content: string }> }} payload
 *        `content` is base64, which is what Resend expects.
 * @param {typeof fetch} fetchImpl
 */
export async function sendMail(payload, fetchImpl = fetch) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY must be set');

  const { to, subject, html, text, attachments } = payload || {};
  if (!Array.isArray(to) || to.length === 0) throw new TypeError('sendMail needs at least one recipient');
  if (typeof subject !== 'string' || subject === '') throw new TypeError('sendMail needs a subject');
  if (typeof html !== 'string' || html === '') throw new TypeError('sendMail needs an html body');

  const body = {
    from: process.env.INTAKE_FROM_EMAIL || 'intake@mnrv.nl',
    to,
    subject,
    html,
  };
  if (text) body.text = text;
  if (Array.isArray(attachments) && attachments.length > 0) body.attachments = attachments;

  const res = await fetchImpl(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = '<unreadable body>';
    }
    throw new Error(`Resend refused the message with status ${res.status}: ${detail}`);
  }
  return res.json();
}
