# LAVA Voice Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build LAVA, a spoken intake agent on mnrv.nl that holds a Dutch conversation with a prospect, books an appointment in `info@mnrv.nl`'s calendar, and mails Dave a readable eight-point report.

**Architecture:** An ElevenLabs Agents-platform agent (Claude as the model, voice `4giVXkrLUjoVUeP6Gqol`) handles speech and turn-taking. All business logic lives in Vercel functions under `api/lava/` as webhook tools: availability, booking, report. A browser module `js/lava/` connects over WebRTC using a short-lived token minted server-side, renders the Win98 `LAVA.exe` window plus a live "Wat LAVA begrijpt" notes window, and falls back to an overlay shell on mobile and on the modern route. Pure logic (booking rules, ICS, report composition, notes model) sits in importable ESM modules so it is unit-testable without a browser or a network.

**Tech Stack:** Vanilla ES modules (no bundler — the site has none), Node 18+ Vercel functions as `.mjs`, `node:test` for tests, `@elevenlabs/client` from a pinned jsDelivr ESM URL, Google Calendar REST v3, Resend, Supabase (counter only), Cloudflare Turnstile.

**Spec:** `docs/superpowers/specs/2026-10-18-mnrv-lava-voice-agent-design.md`

## Global Constraints

- Conversation language: Dutch by default; switch to English on detection. The opening line is always Dutch.
- Opening line, verbatim: `"Je spreekt met LAVA van MNRV. Ik ben er om uit te zoeken wat MNRV voor je kan doen, en als het past zet ik meteen een afspraak in de agenda. Vertel eens, waar loop je tegenaan?"`
- LAVA does **not** state that he is AI or that the voice is a clone. This is the owner's decision; build it so one string change enables it.
- LAVA never speaks client names (FAINL, Windofy, De Notenman, Oostendorp Auto).
- Max conversation 600 seconds; LAVA starts wrapping up at 480 seconds.
- Daily ceiling: 20 granted sessions per calendar day in `Europe/Amsterdam`.
- Booking rules: Mon–Fri, 09:00–17:00 `Europe/Amsterdam`, 30-minute slots, minimum 24 hours ahead, maximum 21 days ahead, maximum 2 LAVA appointments per day.
- Event titles: `LAVA intake — <naam>` and `Terugbelverzoek — <naam>`.
- Model: Claude. No silent fallback to another model; if it needs a custom-LLM key, add the key.
- Mail: Resend, from `intake@mnrv.nl` (env `INTAKE_FROM_EMAIL`), to `info@mnrv.nl` (env `INTAKE_ADMIN_EMAIL`). The client is never added as a calendar attendee.
- Retention: audio 90 days, transcripts 365 days.
- Mobile is in scope for v1.
- All user-visible strings are Dutch. Identifiers, code, tests, commit messages and log output are English.
- No database for conversations. Supabase is used only for the session counter and report idempotency.
- Every CDN URL pins an exact version. No floating tags.
- New functions are `.mjs` (ESM). Do not convert the existing CommonJS `api/send-intake-mail.js`.

## Review Focus

1. **Duplicate report.** LAVA's own report tool call and the post-call fallback can both fire for one conversation, mailing Dave and the client twice. → test in Task 9.
2. **Slot race.** Two conversations running at once are offered the same slot; the second write must fail cleanly and LAVA must get a usable error. → test in Task 8.
3. **Day boundary.** The ceiling and "minimum 24 hours ahead" are counted in `Europe/Amsterdam`, not UTC, and must survive a DST change; a Friday 16:50 request must not land on Saturday. → tests in Tasks 1 and 5.
4. **Callback without a phone number.** Ending 3 needs a phone number; booking one without it must be refused rather than written. → test in Task 8.
5. **Bad client email.** A typo'd visitor address must not stop Dave's report from arriving. → test in Task 9.

---

## File Structure

**Create — pure logic (unit-tested, no I/O):**
- `api/lava/_lib/rules.mjs` — slot generation and booking-rule validation
- `api/lava/_lib/ics.mjs` — iCalendar text
- `api/lava/_lib/report.mjs` — eight-point report → text + HTML
- `api/lava/_lib/guards.mjs` — tool-auth and Turnstile verification
- `js/lava/notes.mjs` — notes render model
- `js/lava/shell.mjs` — which shell to render in

**Create — I/O:**
- `api/lava/_lib/google.mjs` — Calendar auth, freebusy, insert
- `api/lava/_lib/store.mjs` — Supabase counter and idempotency
- `api/lava/_lib/mail.mjs` — Resend with attachments
- `api/lava/session.mjs`, `availability.mjs`, `book.mjs`, `report.mjs`, `post-call.mjs`

**Create — front end:**
- `js/lava/index.mjs` — entry: SDK session, client tools, DOM wiring
- `js/lava/meter.mjs` — VU meter from the output analyser
- `css/lava.css`

**Modify:**
- `index.html` — replace `#lava-window` body, add `#lava-notes-window`, load `css/lava.css` and `js/lava/index.mjs`
- `assets/mnrv.html:1564,1735` — CTAs start LAVA; add the "liever typen" link
- `vercel.json` — drop the `omnicontent.nl` delegation
- `package.json` — add `test` script

**Test:** `tests/lava-rules.test.mjs`, `tests/lava-ics.test.mjs`, `tests/lava-report.test.mjs`, `tests/lava-guards.test.mjs`, `tests/lava-store.test.mjs`, `tests/lava-endpoints.test.mjs`, `tests/lava-frontend.test.mjs`, `tests/lava-integration.test.mjs`

---

### Task 1: Booking rules and the test harness

**Files:**
- Create: `api/lava/_lib/rules.mjs`
- Modify: `package.json`
- Test: `tests/lava-rules.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BOOKING_RULES` — frozen object: `{ timeZone: 'Europe/Amsterdam', workdays: [1,2,3,4,5], dayStartHour: 9, dayEndHour: 17, slotMinutes: 30, minLeadHours: 24, maxAheadDays: 21, maxPerDay: 2 }`
  - `generateSlots(now: Date, busy: Array<{start: string, end: string}>, bookedPerDay: Record<string, number>) -> Array<{start: string, end: string}>` — ISO 8601 strings with offset, ascending, free slots only
  - `validateSlot(now: Date, startIso: string) -> { ok: true } | { ok: false, reason: 'outside_hours' | 'weekend' | 'too_soon' | 'too_far' | 'not_on_grid' }`

- [ ] **Step 1: Add the test script**

In `package.json`, add `"scripts": { "test": "node --test tests/" }`.

- [ ] **Step 2: Write the failing tests**

```js
// tests/lava-rules.test.mjs
test('generateSlots skips weekends')
test('generateSlots respects minLeadHours of 24')          // Friday 16:50 -> first slot Monday, never Saturday
test('generateSlots excludes slots overlapping a busy block')
test('generateSlots drops days that already hold maxPerDay LAVA appointments')
test('generateSlots returns slots on the half-hour grid inside 09:00-17:00 only')
test('generateSlots keeps local 09:00 across the October DST change')  // 2026-10-25 boundary
test('validateSlot rejects 08:30 with outside_hours')
test('validateSlot rejects a Saturday with weekend')
test('validateSlot rejects a slot 23 hours out with too_soon')
test('validateSlot rejects a slot 22 days out with too_far')
test('validateSlot rejects 09:07 with not_on_grid')
test('validateSlot accepts a Tuesday 14:00 three days out')
```

Assert on exact ISO strings with offsets (`+01:00` / `+02:00`), not on `Date` objects.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `api/lava/_lib/rules.mjs`

- [ ] **Step 4: Implement `rules.mjs`**

Do the timezone arithmetic with `Intl.DateTimeFormat` and the `timeZone` option; do not add a date library — the project has no dependencies beyond `@vercel/speed-insights`, and offsets must stay correct across DST.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json api/lava/_lib/rules.mjs tests/lava-rules.test.mjs
git commit -m "feat(lava): booking rules and slot generation"
```

---

### Task 2: ICS builder

**Files:**
- Create: `api/lava/_lib/ics.mjs`
- Test: `tests/lava-ics.test.mjs`

**Interfaces:**
- Consumes: `BOOKING_RULES` from Task 1.
- Produces: `buildIcs(appointment: { uid: string, startIso: string, endIso: string, summary: string, description: string, organizerEmail: string, attendeeEmail: string, meetUrl?: string }) -> string`

- [ ] **Step 1: Write the failing tests**

```js
test('buildIcs emits VCALENDAR/VEVENT with VERSION:2.0 and METHOD:REQUEST')
test('buildIcs writes DTSTART/DTEND as UTC basic format ending in Z')
test('buildIcs folds lines longer than 75 octets')
test('buildIcs escapes commas, semicolons and newlines in SUMMARY and DESCRIPTION')
test('buildIcs includes the Meet url in DESCRIPTION when given and omits the line when not')
test('buildIcs terminates every line with CRLF')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-ics.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement `buildIcs` in `api/lava/_lib/ics.mjs`**

Hand-roll the text per RFC 5545; no library.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-ics.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/_lib/ics.mjs tests/lava-ics.test.mjs
git commit -m "feat(lava): iCalendar builder"
```

---

### Task 3: Report composer

**Files:**
- Create: `api/lava/_lib/report.mjs`
- Test: `tests/lava-report.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LEAD_LABELS` — frozen array: `['binnen_de_lijnen', 'buiten_de_lijnen', 'student', 'recruiter', 'bestaande_klant']`
  - `normalizeReport(input: object) -> { ok: true, report: Report } | { ok: false, missing: string[] }` where `Report` holds `naam, email, telefoon?, label, uitdaging, beoogde_oplossing, verwachting, gespreksdoel, uitkomst, follow_up, vervolgactie, transcript, ending`
  - `renderReportHtml(report: Report) -> string`
  - `renderReportText(report: Report) -> string`

Required fields are `naam`, `email`, `uitdaging`, `label`, `ending`. Everything else renders as the Dutch literal `Niet aan de orde gekomen` when absent — never invented, never an empty heading.

- [ ] **Step 1: Write the failing tests**

```js
test('normalizeReport reports missing required fields instead of defaulting them')
test('normalizeReport rejects a label outside LEAD_LABELS')
test('normalizeReport defaults vervolgactie owner to "Dave"')
test('renderReportHtml escapes HTML in every field')          // "<script>" in uitdaging
test('renderReportHtml prints "Niet aan de orde gekomen" for absent optional fields')
test('renderReportHtml puts the lead label in the first line of the body')
test('renderReportText contains all eight sections in spec order')
test('renderReportText ends with the full transcript verbatim')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-report.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement `report.mjs`**

Reuse the escaping approach already in `api/send-intake-mail.js` (`escapeHtml`) rather than inventing a second one — copy it into this module, since that file is CommonJS and cannot be imported from ESM.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-report.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/_lib/report.mjs tests/lava-report.test.mjs
git commit -m "feat(lava): eight-point report composer"
```

---

### Task 4: Google Calendar client

**Files:**
- Create: `api/lava/_lib/google.mjs`
- Test: `tests/lava-endpoints.test.mjs` (Google section)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `getAccessToken(fetchImpl = fetch) -> Promise<string>`
  - `getBusy(timeMinIso: string, timeMaxIso: string, fetchImpl = fetch) -> Promise<Array<{start,end}>>`
  - `countLavaEventsPerDay(timeMinIso, timeMaxIso, fetchImpl = fetch) -> Promise<Record<string, number>>` — counts events whose summary starts with `LAVA intake —` or `Terugbelverzoek —`
  - `insertEvent(event: { startIso, endIso, summary, description, withMeet: boolean }, fetchImpl = fetch) -> Promise<{ id: string, htmlLink: string, meetUrl?: string }>`

Every function takes `fetchImpl` as its last parameter so tests inject a stub. No network in tests.

Env: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` (default `info@mnrv.nl`), `GOOGLE_IMPERSONATE_SUBJECT` (optional, for domain-wide delegation).

- [ ] **Step 1: Write the failing tests**

```js
test('getAccessToken signs a JWT with RS256 and posts it to the Google token endpoint')
test('getAccessToken throws a named error when GOOGLE_PRIVATE_KEY is absent')
test('getBusy returns the freeBusy busy array for the configured calendar')
test('countLavaEventsPerDay counts only LAVA intake and Terugbelverzoek summaries')
test('insertEvent sends no attendees field')                 // Review Focus: no double invitation
test('insertEvent requests conferenceData only when withMeet is true')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement `google.mjs`**

Sign the service-account JWT with `node:crypto` (`createSign('RSA-SHA256')`); do not add `googleapis`. Normalize `\n` escapes in `GOOGLE_PRIVATE_KEY`, because Vercel environment variables store it on one line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/_lib/google.mjs tests/lava-endpoints.test.mjs
git commit -m "feat(lava): Google Calendar client"
```

---

### Task 5: Guards and store

**Files:**
- Create: `api/lava/_lib/guards.mjs`, `api/lava/_lib/store.mjs`
- Test: `tests/lava-guards.test.mjs`, `tests/lava-store.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `verifyToolAuth(req) -> boolean` — constant-time compare of header `x-lava-tool-secret` against `LAVA_TOOL_SECRET`
  - `verifyTurnstile(token: string, ip: string, fetchImpl = fetch) -> Promise<boolean>`
  - `amsterdamDateKey(date: Date) -> string` — `YYYY-MM-DD` in `Europe/Amsterdam`
  - `countSessionsToday(now: Date, clientImpl) -> Promise<number>`
  - `recordSessionGrant(now: Date, ipHash: string, clientImpl) -> Promise<void>`
  - `claimReport(conversationId: string, clientImpl) -> Promise<boolean>` — `true` only for the first caller

Supabase tables, added to `supabase/supabase-lava.sql` in this task:
`lava_session_grants(id uuid pk, granted_at timestamptz, day_key text, ip_hash text)` and
`lava_reports(conversation_id text pk, claimed_at timestamptz)`.
Both are service-role only — no `anon` grants, unlike `website_intakes`.

- [ ] **Step 1: Write the failing tests**

```js
// guards
test('verifyToolAuth rejects a missing header')
test('verifyToolAuth rejects a wrong secret of equal length')
test('verifyToolAuth accepts the configured secret')
test('verifyTurnstile posts the token and returns the success flag')
test('verifyTurnstile returns false when the siteverify call throws')
// store
test('amsterdamDateKey returns the local day for 23:30 UTC in summer')   // Review Focus: day boundary
test('amsterdamDateKey returns the local day across the DST change')
test('countSessionsToday filters on the Amsterdam day key, not UTC')
test('claimReport returns true once and false for the same conversation id')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-guards.test.mjs tests/lava-store.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement both modules**

`store.mjs` talks to Supabase over the REST endpoint with `fetch` and the service-role key (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); do not add `@supabase/supabase-js` to a project that has no build step. `claimReport` relies on the primary-key conflict: insert and treat a 409 as "already claimed".

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-guards.test.mjs tests/lava-store.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/_lib/guards.mjs api/lava/_lib/store.mjs supabase/supabase-lava.sql tests/lava-guards.test.mjs tests/lava-store.test.mjs
git commit -m "feat(lava): request guards and session store"
```

---

### Task 6: Session endpoint

**Files:**
- Create: `api/lava/session.mjs`
- Test: `tests/lava-endpoints.test.mjs` (session section)

**Interfaces:**
- Consumes: `verifyTurnstile`, `countSessionsToday`, `recordSessionGrant`, `amsterdamDateKey` (Task 5).
- Produces: `POST /api/lava/session` with body `{ turnstileToken: string }` returning `200 { token: string, agentId: string }`, or `429 { error: 'daily_limit_reached' }`, or `403 { error: 'bot_check_failed' }`.

Env: `ELEVENLABS_API_KEY`, `LAVA_AGENT_ID`, `LAVA_DAILY_LIMIT` (default `20`), `TURNSTILE_SECRET_KEY`.

- [ ] **Step 1: Write the failing tests**

```js
test('session rejects a non-POST method with 405')
test('session returns 403 bot_check_failed when Turnstile fails')
test('session returns 429 daily_limit_reached at the 21st grant of the day')
test('session returns 429 before calling ElevenLabs')          // no credits spent when full
test('session mints a token from /v1/convai/conversation/token with the api key in the header')
test('session never puts ELEVENLABS_API_KEY in the response body')
test('session records a grant with a hashed ip, not the raw ip')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement the handler**

`export default async function handler(req, res)`. Call
`GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=<LAVA_AGENT_ID>` with the `xi-api-key` header and return only the token. Hash the IP with `createHash('sha256')` over the IP plus `LAVA_TOOL_SECRET` as salt. Order matters: method check, Turnstile, ceiling, mint, record.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/session.mjs tests/lava-endpoints.test.mjs
git commit -m "feat(lava): session token endpoint with daily ceiling"
```

---

### Task 7: Availability endpoint

**Files:**
- Create: `api/lava/availability.mjs`
- Test: `tests/lava-endpoints.test.mjs` (availability section)

**Interfaces:**
- Consumes: `generateSlots` (Task 1), `getBusy`, `countLavaEventsPerDay` (Task 4), `verifyToolAuth` (Task 5).
- Produces: `POST /api/lava/availability` returning `200 { slots: Array<{ start: string, label: string }> }`, at most 3 slots. `label` is Dutch and speakable — `"dinsdag 21 oktober om 14:00"`.

- [ ] **Step 1: Write the failing tests**

```js
test('availability returns 401 without the tool secret')
test('availability returns at most three slots')
test('availability labels a slot in speakable Dutch with no year')
test('availability returns an empty array and no error when the next three weeks are full')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement the handler**

Query freebusy from now to `maxAheadDays` out. Build the Dutch label with `Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/availability.mjs tests/lava-endpoints.test.mjs
git commit -m "feat(lava): availability tool endpoint"
```

---

### Task 8: Booking endpoint

**Files:**
- Create: `api/lava/book.mjs`
- Test: `tests/lava-endpoints.test.mjs` (book section)

**Interfaces:**
- Consumes: `validateSlot` (Task 1), `buildIcs` (Task 2), `getBusy`, `insertEvent` (Task 4), `verifyToolAuth` (Task 5).
- Produces: `POST /api/lava/book` with body `{ kind: 'intake' | 'callback', naam, email, telefoon?, uitdaging, startIso, conversationId }` returning `200 { ok: true, startIso, label, icsText }` or `409 { ok: false, reason: 'slot_taken' }` or `400 { ok: false, reason: <validateSlot reason> | 'phone_required' | 'missing_field' }`.

`icsText` is the full iCalendar text. The agent passes it straight to the `show_appointment` client tool (Task 12) so the browser can offer it as a download; nothing is stored between requests.

The response is read aloud by LAVA, so `reason` values are stable machine strings and the agent prompt maps them to Dutch sentences.

- [ ] **Step 1: Write the failing tests**

```js
test('book returns 401 without the tool secret')
test('book refuses kind=callback without telefoon with phone_required')   // Review Focus
test('book refuses a missing naam, email or uitdaging with missing_field')
test('book re-checks freebusy and returns 409 slot_taken when the slot filled since the offer')  // Review Focus
test('book titles an intake event "LAVA intake — <naam>"')
test('book titles a callback event "Terugbelverzoek — <naam>" and includes the phone number in the body')
test('book requests a Meet link for intake and not for callback')
test('book propagates validateSlot rejections without calling insertEvent')
test('book returns icsText containing the booked start time')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement the handler**

Order: tool auth, field validation, `validateSlot`, freebusy re-check for exactly that slot, `insertEvent`. Keep the ICS text in memory keyed by `icsToken` only as far as the report endpoint needs it — regenerate it in Task 9 from the stored appointment fields instead of holding state between requests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/book.mjs tests/lava-endpoints.test.mjs
git commit -m "feat(lava): booking tool endpoint"
```

---

### Task 9: Report endpoint

**Files:**
- Create: `api/lava/report.mjs`, `api/lava/_lib/mail.mjs`
- Test: `tests/lava-endpoints.test.mjs` (report section)

**Interfaces:**
- Consumes: `normalizeReport`, `renderReportHtml`, `renderReportText` (Task 3), `buildIcs` (Task 2), `claimReport` (Task 5), `verifyToolAuth` (Task 5).
- Produces:
  - `sendMail(payload: { to: string[], subject: string, html: string, attachments?: Array<{ filename: string, content: string }> }, fetchImpl = fetch) -> Promise<object>` in `mail.mjs`
  - `POST /api/lava/report` with body `{ conversationId, report, appointment? }` returning `200 { ok: true, mailed: boolean }` or `200 { ok: true, mailed: false, reason: 'already_sent' }` or `400 { ok: false, missing: string[] }`

- [ ] **Step 1: Write the failing tests**

```js
test('report returns 401 without the tool secret')
test('report returns missing fields from normalizeReport without mailing')
test('report mails info@mnrv.nl with the eight sections')
test('report attaches the ics only when an appointment is present')
test('report mails the visitor the invitation only, without the report body')
test('report still resolves ok when the visitor mail fails')      // Review Focus: bad client email
test('report sends nothing on a second call with the same conversationId')  // Review Focus: duplicate
test('report base64-encodes the ics attachment for Resend')
```

Assert the visitor-mail failure case by stubbing `fetchImpl` to reject only for the visitor address and asserting the admin mail still went and the response is `ok: true`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement both modules**

`mail.mjs` posts to `https://api.resend.com/emails` with `RESEND_API_KEY`, mirroring `api/send-intake-mail.js` but adding `attachments`. In the handler, claim idempotency **before** mailing, and send the admin mail before the visitor mail so a visitor-address failure cannot cost Dave the lead.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/report.mjs api/lava/_lib/mail.mjs tests/lava-endpoints.test.mjs
git commit -m "feat(lava): report endpoint with idempotent delivery"
```

---

### Task 10: Post-call fallback

**Files:**
- Create: `api/lava/post-call.mjs`
- Test: `tests/lava-endpoints.test.mjs` (post-call section)

**Interfaces:**
- Consumes: `claimReport` (Task 5), the report endpoint's composition path (Task 9).
- Produces: `POST /api/lava/post-call` — the ElevenLabs post-call webhook. Verifies the HMAC signature header against `ELEVENLABS_WEBHOOK_SECRET`, and only if `claimReport` succeeds, builds a report from the transcript and mails it.

- [ ] **Step 1: Write the failing tests**

```js
test('post-call returns 401 on a bad signature')
test('post-call does nothing when the conversation was already claimed by the report tool')
test('post-call composes a report from the transcript when nothing was claimed')
test('post-call marks a fallback report as such in the subject')   // Dave must see it is a reconstruction
test('post-call never books an appointment')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement the handler**

Verify the signature with `createHmac('sha256', secret)` over the raw body; read the raw body before any JSON parsing. The extraction of the eight points from a transcript is a single Claude call via the Anthropic Messages API (`ANTHROPIC_API_KEY`), prompted to return the `Report` shape and to leave fields absent rather than guess.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-endpoints.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/lava/post-call.mjs tests/lava-endpoints.test.mjs
git commit -m "feat(lava): post-call report fallback"
```

---

### Task 11: Front-end logic modules

**Files:**
- Create: `js/lava/notes.mjs`, `js/lava/shell.mjs`
- Test: `tests/lava-frontend.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createNotesModel() -> { apply(update: { understood?: string, open?: string }): void, render(): { understood: string, open: string, hasContent: boolean } }` — later updates replace earlier ones; LAVA rewrites, it does not append
  - `pickShell(viewportWidth: number, pathname: string) -> 'window' | 'overlay'` — `'overlay'` below 768px or when the pathname is not `/` or `/index.html`

- [ ] **Step 1: Write the failing tests**

```js
test('notes model starts with hasContent false')
test('notes model replaces the understood text on a second apply')
test('notes model keeps the previous open text when an update omits it')
test('pickShell returns overlay at 360 width on the desktop path')
test('pickShell returns overlay on /assets/mnrv.html at 1440 width')
test('pickShell returns window on / at 1440 width')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-frontend.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement both modules**

Plain ESM, no DOM access — these are imported by both the browser entry and the tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lava-frontend.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/lava/notes.mjs js/lava/shell.mjs tests/lava-frontend.test.mjs
git commit -m "feat(lava): notes model and shell selection"
```

---

### Task 12: LAVA.exe on the desktop

**Files:**
- Create: `js/lava/index.mjs`, `js/lava/meter.mjs`, `css/lava.css`
- Modify: `index.html:337-358` (replace the `#lava-window` body), `index.html:635` (add the module script and the stylesheet link)
- Test: `tests/lava-integration.test.mjs`

**Interfaces:**
- Consumes: `/api/lava/session` (Task 6), `createNotesModel`, `pickShell` (Task 11), `window.MNRV.showWindow` / `hideWindow` from `js/main.js:540`.
- Produces: `window.LAVA = { start(), stop() }` so the CTAs in Task 13 can call it.

The existing `#lava-window` keeps its id and `win-window` classes, so the drag, resize, minimise and close behaviour in `js/main.js` keeps working. Its address bar and iframe are removed; the body becomes the orb, the VU meter, LAVA's last line and the two buttons. A second window `#lava-notes-window` is added with the same chrome.

Two client tools registered with the SDK:

- `update_notes({ understood, open })` — rewrites the notes window.
- `show_appointment({ label, icsText })` — opens a third window `#lava-appointment-window` with the Dutch label of the booked moment and a button `Uitnodiging ophalen` that downloads `icsText` as `lava-afspraak.ics` from an object URL. The agent calls this right after `book_appointment` succeeds, with the `icsText` from that response.

The `Dit klopt niet` button in the notes window calls the SDK's `sendUserMessage('Dat klopt niet.')`, so LAVA hears the correction and responds instead of the page silently editing its own notes.

Server tools are reached by the agent, not the browser.

- [ ] **Step 1: Write the failing tests**

```js
// static assertions over the HTML and CSS, in the style of tests/reported-diagnostics.test.mjs
test('index.html no longer references omnicontent.nl')
test('index.html has no iframe inside #lava-window')
test('index.html keeps the My LAVA desktop icon pointing at data-window="lava-window"')
test('index.html contains a #lava-notes-window with win-titlebar and win-body')
test('index.html contains a #lava-appointment-window with an Uitnodiging ophalen button')
test('index.html loads js/lava/index.mjs as type="module"')
test('index.html loads css/lava.css')
test('css/lava.css defines no colour outside the Win98 palette already used in css/style.css')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-integration.test.mjs`
Expected: FAIL

- [ ] **Step 3: Replace the window body and write the client**

Import the SDK from a pinned jsDelivr ESM URL — `https://cdn.jsdelivr.net/npm/@elevenlabs/client@<exact-version>/+esm`. Look the exact published version up on npm before writing the line; never `@latest` and never a major-only range. Start the session with `Conversation.startSession({ conversationToken, connectionType: 'webrtc', clientTools: { update_notes } })`. Drive the meter from the SDK's output frequency data via `requestAnimationFrame`; keep `meter.mjs` to converting a frequency array into bar heights so it stays the only untested piece.

Dutch strings only in the UI: `Pauzeer`, `Beëindig gesprek`, `Verbonden`, `Wat LAVA begrijpt`, `Dit klopt niet`, `Uitnodiging ophalen`, and the ceiling message `LAVA zit vandaag vol. Vul het formulier in of mail ons.`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Verify in a browser**

Use the `browser-automation` skill against the local site: open `/`, click the My LAVA icon, confirm the window opens, the console has no errors, and `/api/lava/session` is requested exactly once.

- [ ] **Step 6: Commit**

```bash
git add index.html js/lava/index.mjs js/lava/meter.mjs css/lava.css tests/lava-integration.test.mjs
git commit -m "feat(lava): LAVA.exe window and browser client"
```

---

### Task 13: Overlay shell, mobile, and site integration

**Files:**
- Modify: `js/lava/index.mjs`, `css/lava.css`, `assets/mnrv.html:1564`, `assets/mnrv.html:1735`, `vercel.json`
- Test: `tests/lava-integration.test.mjs`

**Interfaces:**
- Consumes: `window.LAVA.start()` (Task 12), `pickShell` (Task 11).
- Produces: nothing for later tasks.

In the overlay shell there is no second floating window: the notes become a strip under LAVA.exe that can be collapsed, and the whole thing is one centred panel with no drag or resize. This shell serves both mobile and `assets/mnrv.html`.

- [ ] **Step 1: Write the failing tests**

```js
test('assets/mnrv.html start-een-project CTA calls window.LAVA.start and no longer links to #contact')
test('assets/mnrv.html okaay-lets-go CTA calls window.LAVA.start instead of opening the intake modal')
test('assets/mnrv.html offers a liever-typen link to intakeformulier.html next to each CTA')
test('assets/mnrv.html loads js/lava/index.mjs and css/lava.css')
test('vercel.json Permissions-Policy grants microphone to self only')
test('vercel.json no longer mentions omnicontent.nl')
test('css/lava.css collapses the notes strip under a 768px media query')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lava-integration.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement**

`assets/mnrv.html` is also served inside the sandboxed iframe at `portfolio.html:153`, which is an opaque origin where `getUserMedia` cannot work. Detect it with `window.self !== window.top` and, in that case only, open `/index.html?lava=1` in a new tab — the sandbox allows popups but not top-level navigation. Outside the frame, start the overlay in place. `index.html` reads `?lava=1` on load and opens LAVA itself.

Keep `#open-intake-modal`'s modal code in place; it is what the "liever typen" link now triggers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Verify both shells in a browser**

With the `browser-automation` skill: `/assets/mnrv.html` at 1440px wide, then `/` at 375px wide. Confirm the overlay appears in both, there is no horizontal page scroll at 375px, and the microphone prompt follows a real click.

- [ ] **Step 6: Commit**

```bash
git add js/lava/index.mjs css/lava.css assets/mnrv.html vercel.json tests/lava-integration.test.mjs
git commit -m "feat(lava): overlay shell, mobile layout and site integration"
```

---

### Task 14: Agent configuration and end-to-end verification

**Files:**
- Create: `docs/lava-agent-config.md` — the agent's system prompt and every platform setting, in version control, so the workspace can be rebuilt
- Test: manual, recorded in the same document

**Interfaces:**
- Consumes: every endpoint from Tasks 6–10.
- Produces: a working agent id for `LAVA_AGENT_ID`.

Configure through the ElevenLabs MCP tools or the dashboard:

- voice `4giVXkrLUjoVUeP6Gqol`; model Claude; `language: nl`; language detection on with an English preset
- `first_message`: the opening line from Global Constraints
- `max_duration_seconds: 600`; wrap-up instruction at 480 in the prompt
- knowledge base: the six propositions, the USPs, the team, `index.html`, `assets/mnrv.html`, `portfolio.html`; RAG on. **No client names.**
- webhook tools `get_availability`, `book_appointment`, `send_report` → the three endpoints, each sending `x-lava-tool-secret`
- client tools `update_notes` and `show_appointment`
- post-call webhook → `/api/lava/post-call`
- `daily_limit: 25` and `agent_concurrency_limit: 3` as a backstop under MNRV's own ceiling of 20
- privacy: `retention_days: 90` for audio, transcripts 365
- the prompt must carry: §4.1 who is welcome, the two exceptions, the four endings, the floor (naam, e-mail, uitdaging, afspraak), the rule that an out-of-scope request is recorded but never promised, and the Dutch sentences for each `reason` value the booking endpoint can return

- [ ] **Step 1: Write the configuration document**

- [ ] **Step 2: Configure the agent and record the agent id**

- [ ] **Step 3: Run the three paths as real conversations**

An intake that books; an existing client that gets a callback; a recruiter selling services that ends without an appointment. For each, confirm: the mail arrives at `info@mnrv.nl` with eight sections and the right label, the event has the right title and no attendees, the visitor gets only an invitation, and exactly one mail arrives per conversation.

- [ ] **Step 4: Verify the ceiling and the full-up message**

Set `LAVA_DAILY_LIMIT=1`, start a second conversation, confirm LAVA says he is full and points at the form, and that no ElevenLabs call was made.

- [ ] **Step 5: Commit**

```bash
git add docs/lava-agent-config.md
git commit -m "docs(lava): agent configuration and verification record"
```

---

## Notes for the executor

- `MNRV-main` is **not a git repository** right now. Run `git init` and make an initial commit before Task 1, or the commit steps cannot run.
- Required environment variables, all new: `ELEVENLABS_API_KEY`, `LAVA_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `LAVA_TOOL_SECRET`, `LAVA_DAILY_LIMIT`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `GOOGLE_IMPERSONATE_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`. `RESEND_API_KEY`, `INTAKE_FROM_EMAIL` and `INTAKE_ADMIN_EMAIL` already exist.
- Tasks 1–5 and 11 are pure and have no external dependencies; they can be built in any order. Tasks 6–10 each need their Task 1–5 modules. Task 12 needs Task 6. Task 13 needs Task 12. Task 14 needs everything.
- Spec items deliberately **not** in this plan, because they are the owner's open decisions (spec §15): whether the AI disclosure returns, whether client names may be spoken, Oostendorp Auto material, per-service-line owners, and whether the updated privacy documents gate go-live.
