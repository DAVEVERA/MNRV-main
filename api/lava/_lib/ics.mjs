// iCalendar (RFC 5545) text for one booked appointment. Formatting only:
// callers decide the times, the uid and who is invited.

const CRLF = '\r\n';
const MAX_OCTETS = 75;

// UTC basic format, e.g. 20261020T080000Z.
function toUtcBasic(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Escape a TEXT value: backslash first, then separators and line breaks.
function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// Fold to at most 75 octets per physical line. Continuation lines start with a
// space, which counts toward the limit. Never splits a multi-byte character.
function fold(line) {
  const parts = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

export function buildIcs(appointment, now = new Date()) {
  const { uid, startIso, endIso, summary, description, organizerEmail, attendeeEmail, meetUrl } = appointment;
  const fullDescription = meetUrl ? `${description}\n\nGoogle Meet: ${meetUrl}` : description;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MNRV//LAVA//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toUtcBasic(now)}`,
    `DTSTART:${toUtcBasic(startIso)}`,
    `DTEND:${toUtcBasic(endIso)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(fullDescription)}`,
    `ORGANIZER:mailto:${organizerEmail}`,
    `ATTENDEE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join(CRLF) + CRLF;
}
