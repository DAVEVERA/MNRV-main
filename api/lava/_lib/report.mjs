// Pure report composer: turns the structured facts of a conversation into the
// owner's one email (text and HTML). No I/O. Rendered output is Dutch.

export const LEAD_LABELS = Object.freeze([
  'binnen_de_lijnen',
  'buiten_de_lijnen',
  'student',
  'recruiter',
  'bestaande_klant',
]);

// Four conversation endings plus the fallback (report rebuilt from a transcript).
export const ENDINGS = Object.freeze([
  'appointment',
  'follow_up_request',
  'callback_request',
  'no_opportunity',
  'fallback',
]);

const ABSENT = 'Niet aan de orde gekomen';
const DEFAULT_OWNER = 'Dave';
const REQUIRED = ['naam', 'email', 'uitdaging', 'label', 'ending'];

const LABEL_NL = {
  binnen_de_lijnen: 'Binnen de lijnen',
  buiten_de_lijnen: 'Buiten de lijnen',
  student: 'Student',
  recruiter: 'Recruiter',
  bestaande_klant: 'Bestaande klant',
};

const FALLBACK_NOTE = 'Let op: dit rapport is achteraf samengesteld uit het transcript.';

// Copied from api/send-intake-mail.js (CommonJS, so it cannot be imported here).
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function clean(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function normalizeReport(input) {
  const source = input && typeof input === 'object' ? input : {};
  const missing = REQUIRED.filter((key) => {
    const value = clean(source[key]);
    if (value === undefined) return true;
    if (key === 'label') return !LEAD_LABELS.includes(value);
    if (key === 'ending') return !ENDINGS.includes(value);
    return false;
  });
  if (missing.length > 0) return { ok: false, missing };

  const action = source.vervolgactie && typeof source.vervolgactie === 'object' ? source.vervolgactie : {};
  const report = {
    naam: clean(source.naam),
    email: clean(source.email),
    telefoon: clean(source.telefoon),
    label: clean(source.label),
    uitdaging: clean(source.uitdaging),
    beoogde_oplossing: clean(source.beoogde_oplossing),
    verwachting: clean(source.verwachting),
    gespreksdoel: clean(source.gespreksdoel),
    uitkomst: clean(source.uitkomst),
    follow_up: clean(source.follow_up),
    vervolgactie: { wat: clean(action.wat), door: clean(action.door) || DEFAULT_OWNER },
    // Verbatim: not trimmed, only checked for presence.
    transcript:
      typeof source.transcript === 'string' && source.transcript.trim() !== ''
        ? source.transcript
        : undefined,
    ending: clean(source.ending),
  };
  return { ok: true, report };
}

function sections(report) {
  const action = report.vervolgactie || {};
  return [
    ['De uitdaging', report.uitdaging],
    ['De beoogde oplossing', report.beoogde_oplossing],
    ['Wat ze verwachten', report.verwachting],
    ['Het doel van het gesprek', report.gespreksdoel],
    ['De uitkomst van het gesprek', report.uitkomst],
    ['Follow-up actie', report.follow_up],
    ['Vervolgactie', action.wat ? `${action.wat}\nDoor: ${action.door || DEFAULT_OWNER}` : undefined],
    ['Transcriptie', report.transcript],
  ];
}

function contactLines(report) {
  return [`Naam: ${report.naam}`, `E-mail: ${report.email}`, `Telefoon: ${report.telefoon || ABSENT}`];
}

export function renderReportText(report) {
  const lines = [`Type aanvraag: ${LABEL_NL[report.label] || report.label}`, ''];
  if (report.ending === 'fallback') lines.push(FALLBACK_NOTE, '');
  lines.push(...contactLines(report));
  for (const [heading, value] of sections(report)) {
    lines.push('', heading, value || ABSENT);
  }
  // The transcript is the last section, so the text ends with it verbatim.
  return lines.join('\n');
}

export function renderReportHtml(report) {
  const parts = [
    `<p style="font-size:16px;"><strong>Type aanvraag: ${escapeHtml(LABEL_NL[report.label] || report.label)}</strong></p>`,
  ];
  if (report.ending === 'fallback') parts.push(`<p><em>${escapeHtml(FALLBACK_NOTE)}</em></p>`);
  parts.push(`<p>${contactLines(report).map(escapeHtml).join('<br>')}</p>`);
  for (const [heading, value] of sections(report)) {
    parts.push(
      `<h3 style="margin:20px 0 4px;">${escapeHtml(heading)}</h3>`,
      `<div style="white-space:pre-wrap;">${escapeHtml(value || ABSENT)}</div>`,
    );
  }
  return parts.join('\n');
}
