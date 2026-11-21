// One appointment has one identity. Two places build an ICS for the same
// booking — book.mjs hands it to the browser, report.mjs attaches it to the
// mail — and a calendar client treats two UIDs as two separate events. Both
// derive the id from the slot start here, so there is one implementation.
//
// Lives apart from rules.mjs because that module is pure and dependency-free;
// this one hashes.

import { createHash } from 'node:crypto';

/**
 * Deterministic Google Calendar event id for a slot. Google requires the id to
 * match [a-v0-9]{5,1024}, so the hash is hex and the prefix is lowercase.
 * Being derived from the instant, it also makes a duplicate insert collide
 * (409) instead of creating a second event.
 */
export function eventIdForSlot(startIso) {
  const canonicalStart = new Date(startIso).toISOString();
  return `lava${createHash('sha256').update(canonicalStart).digest('hex').slice(0, 48)}`;
}

/** The iCalendar UID for that same slot. */
export function icsUidForSlot(startIso) {
  return `${eventIdForSlot(startIso)}@mnrv.nl`;
}
