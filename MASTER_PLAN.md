# Bright Path — Scheduling Board with Conflict Detection

> Current authorization (2026-09-16): Bao approved implementation with Astra medium agents, a dedicated Supabase database, and Vercel hosting. This is a public synthetic-data demo with no login, explicitly requested by Bao; anyone with the link can change demo schedules. Earlier planning-only/local-only statements below describe the previous stage and are superseded by this authorization. No real student data or product database is used. The runtime connection secret requires the separate deployment approval recorded in the task.


This is the canonical master plan, based on Bao's supplied implementation plan and the subsequent review. It supersedes the previous execution checklist. Keep `DESIGN.md` (visual design) and `TECHNICAL_DESIGN.md` (business/technical design) aligned with this plan; document any proposed change rather than silently diverging. Repository safety instructions still apply.

Status as of 2026-09-16: implemented MVP under active review. Local application history through `6d4dae6` includes the review fixes, protected rescheduling, atomic participant replacement, and compact conflict UI. Current verification and historical deployment evidence are separated in README; this file is not evidence that the latest code is deployed.

## 1. Goal and scope

Repository: `/Users/bao/GitHub/tutoring-scheduling`.

Requested implementation coordinator: `gpt-6-astra`, medium reasoning. Agents inherit coordinator settings; do not silently change the current model configuration.

Build **one feature: reception manages the daily schedule on a board, with constraint checks on creation/rescheduling and visible history for cancellations and changes after cutoff**.

- User flow: open a day -> understand problems -> add/edit/cancel -> receive confirmed success or the exact reason the action was blocked.
- Data flow: UI -> Next.js API -> PostgreSQL transaction checks and writes schedule/history -> UI reloads authoritative data.
- Success: the app runs with the supplied seed, preserves historical violations, prevents invalid new scheduling writes, and Bao can explain the complete flow.
- Main risks: treating intentional pairs as conflicts, blocking historical import, concurrent writes using stale data, and confusing an audit badge with notification delivery.

Out of scope: catalog CRUD, recurring schedules, drag-and-drop, billing calculations, WhatsApp sending, login, Realtime, a separate attendance workflow, and additional administration tabs. Catalogs are predefined selection options. No generic rule engine, policy settings screen, or override button in v1.

### Timebox

The PDF allows **150 minutes total, including reading and planning**. The original proposed 13:30-16:00 window is historical context, not a fresh timer or a verified remaining budget. At implementation kickoff, record actual elapsed time and remaining time; do not restart the assessment budget. The phase estimates in section 5 must fit the remaining time, otherwise reduce scope or report the shortfall explicitly.

## 2. Interface and business rules

### One English-language screen

- Selected date, Previous/Next/Today controls, tutor and student filters.
- Table: time, students, tutor, room, status, warnings, actions.
- One row per session; a pair shows both students with their individual booking statuses.
- Create/edit form; per-student cancellation requires a reason.
- Conflict details identify related records; change details show before/after values.
- Loading, empty day, empty filter result, connection errors, and validation states.
- Preserve the draft on failed save and disable duplicate submission while pending. Do not show success before the server confirms commit.
- If save is confirmed but refresh fails, show “Saved, unable to refresh” with a reload action. Do not report a failed save or invite resubmission.
- If the write response is lost and the result is unknown, explain the uncertainty and reload/reconcile before another attempt; do not blindly retry creation.
- Compute warnings against the full relevant schedule, not only filtered rows.
- Keep the laptop view compact and the narrow-screen layout usable; use labels, keyboard-accessible controls, focus states, and warning text rather than color alone.

### Rule classification and flexibility

Historical behaviour is evidence to investigate, not blanket permission to reproduce every violation. Flexibility comes from an accurate domain model, centralized policies, and traceable changes.

| Class | Rules | v1 handling |
| --- | --- | --- |
| Mandatory feasibility constraints | A student cannot attend overlapping sessions; a tutor cannot teach overlapping independent sessions; a room cannot host overlapping independent sessions | Block invalid new scheduling writes; no override |
| Operating policies | Opening days/hours, permitted durations, daily tutor booking limit | Centralize policy values; enforce the v1 decisions below. No policy editor or exception workflow |
| Supported business cases | Intentional pair teaching; changes after cutoff | Model explicitly and preserve history rather than treating them as accidental errors |
| Historical violations | Existing overlaps, excessive load, Monday booking | Preserve and display warnings; apply the edit/cancellation rules in section 4 |

| Topic | v1 decision |
| --- | --- |
| Opening days | Tuesday-Sunday; reject new/rescheduled sessions on Monday |
| Opening hours | **Assume 09:00-22:00**; the whole session must fit within that interval on one local day. The PDF gives no exact hours |
| Duration | Only 60 or 90 minutes |
| Interval boundaries | Use `[start, end)`; adjacent sessions are allowed |
| Students | No overlapping active bookings across different sessions |
| Tutors and rooms | No overlapping active independent sessions |
| Pair lessons | Explicit one-to-one or pair mode; a pair starts with exactly two distinct students in one session |
| Tutor load | Maximum **six active student bookings/day**; a pair counts two. This is the conservative interpretation of “bookings,” not six sessions |
| Status | `booked` and `no_show` consume resources; `cancelled` does not |
| Cancel one student in a pair | Shared tutor/room remain occupied while another resource-consuming booking remains |
| Edit a pair | Apply schedule changes to the entire session; explain the affected students in the form |

The owner explicitly wants the tutor limit enforced. Do not infer an overload exception from Mai's historical violations. Monday exceptions may be a legitimate future need, but require owner clarification before supporting them. `DECISIONS.md` must retain questions about booking-versus-session counting, official pair policy, exact hours, and exceptional opening days, with how each answer changes the implementation.

### Demo clock and billing boundary

- Fixed demo now: `2026-03-03T17:00:00+07:00`.
- Timezone: `Asia/Ho_Chi_Minh`.
- Initial selected date: **2026-03-04**, chosen to expose the sample conflict and pair immediately. Document this deliberate departure from a literal today-first landing page.
- Today navigates to March 3. Display the demo clock separately; changing the viewed date never changes now.
- The export was taken on March 10 and contains later statuses. The fixed clock is a demo device, not a reconstruction of what was known on March 3.

No automatic billing in v1. Document the PDF's four-hour cancellation policy. **Whether a tutor-initiated cancellation such as L017 is exempt is an unresolved discovery question**, not an established rule. Defer charges and tutor pay until policy is confirmed.

## 3. Stack, database, and seed

Stack: Next.js App Router, TypeScript, Tailwind, Zod, `postgres`/Postgres.js, Vitest. Use npm and commit its lockfile when commits are authorized. No ORM for this small application.

Use a dedicated Supabase assignment project, never an existing product database. No suitable target or live connection has been verified in this documentation stage. Confirm the project and authorization before provisioning or applying schema changes. Keep the connection string server-only in ignored `.env.local`; provide `.env.example` placeholders.

This is an approved public synthetic-data demonstration hosted on Vercel with dedicated Supabase PostgreSQL. Tables use a private schema excluded from Data API exposure; runtime credentials remain server-only. Login is intentionally omitted. Live deployment does not imply the latest local changes are deployed.

### Data model

| Table | Core data |
| --- | --- |
| students | Internal ID and name; name is not a globally unique identity |
| tutors | CSV tutor ID, name, subject, phone |
| rooms | R1-R6 |
| sessions | ID, start/end, tutor, room, mode, version |
| bookings | ID, session, student, status, cancelled_at, cancellation reason, unique nullable source lesson ID, source note |
| schedule_changes | ID, session, optional booking ID, action, before/after JSON, demo timestamp, reason, after-cutoff flag |

The database enforces primary/foreign keys, required fields, valid statuses/modes, positive version, 60/90-minute duration, source-ID uniqueness, and student uniqueness within a session. Application validation under the write transaction checks cross-session constraints, opening policies, pair cardinality, daily load, and edit eligibility.

Store time consistently and evaluate local days/cutoffs in the centre timezone. Snapshots include session fields and booking identities/statuses, not just a free-text summary.

### Source files and import

The four originals were downloaded on 2026-09-16 from [the supplied Drive folder](https://drive.google.com/drive/folders/1SlVNtCgLHqHDvMn35uvquiUlr0fL-uuM). Keep them unchanged.

| Local file | Drive file ID | Verified bytes |
| --- | --- | ---: |
| ref/01-tutoring-scheduling.pdf | 1WVsJ7yiEehtUAb7urzDZQPhh24KdzrbU | 147636 |
| ref/README.txt | 1gf0T5t23RvMcyCezQmuwJs45XdMY_xhW | 617 |
| ref/lessons_export.csv | 1H15ETOueAHBs25CfO4RUlRYV5_BQ-Mc1 | 2075 |
| ref/tutors.csv | 1h9SZGN-QyvLSEhet6Ylh78oManm_5mKN | 123 |

The PDF's custom font corrupts extracted text; read its rendered pages. Both pages and the README have been reviewed. The README says rows parse and identifiers resolve; violations describe actual historical operations rather than data to repair.

- Import all 34 bookings and 3 supplied tutors; create six rooms from the brief. Do not invent the other tutors mentioned in the business description.
- Map students by name only for this synthetic seed; six distinct names were verified. Use IDs in the application.
- Group only L009/L010 into one session based on their explicit pair notes: expect **33 sessions**. Never merge unrelated rows merely because their time matches.
- Preserve statuses, cancellation timestamps, source IDs, and notes. Do not fabricate historical notification or move events from incomplete notes.
- Seed deterministically and transactionally; reruns must neither duplicate records nor overwrite user edits.
- Do not add a global overlap constraint that prevents importing historical violations.

| Records | Expected evidence |
| --- | --- |
| L007/L008 | Student overlap on March 4 |
| L009/L010 | Intentional pair; no false tutor/room conflict |
| T1 on March 6 | Seven active bookings: L018, L021, L022, L024-L027 |
| L015 | No-show still occupies resources |
| L005/L017 | Cancelled bookings free their resources; retain original cancellation data |
| L032 | Monday booking on March 9; preserve its move note |
| L033/L034 | Tutor overlap in two different rooms on March 10 |

## 4. API, transactions, and history

| Endpoint | Behaviour |
| --- | --- |
| GET /api/schedule?date=YYYY-MM-DD | Daily sessions/bookings, selection catalogs, warnings, relevant changes, demo clock, timezone |
| POST /api/sessions | Create a session with one/two students atomically |
| PATCH /api/sessions/:id | Edit schedule, note, mode and booking statuses; existing booking student identity is immutable; require expectedVersion and reason |
| POST /api/bookings/:id/cancel | Cancel one student's booking; require its session's expectedVersion and reason |

### Editor policy and status transitions

Existing booking IDs retain their original student and source metadata. Directly overwriting studentId is rejected with `BOOKING_IDENTITY`. The editor sends replacementStudentId on the old booking to replace its participant atomically: cancel the old booking, retain its source metadata and cancellation history, and insert a fresh booked record without inherited source or cancellation fields. An ordinary booked session may add one new distinct student when converting to a pair. Existing bookings cannot be removed; cancelled history is retained. One-to-one permits at most one active booking; pair allows up to two active bookings and retains any cancelled history separately.

The edit endpoint accepts date, startTime, durationMin, tutorId, roomId, optional mode/note/bookings, expectedVersion, and a required reason. Each booking edit contains an existing id (or no id for a new second booking), studentId, and status, with optional replacementStudentId. All supplied existing IDs must belong to the session and all stored bookings must remain represented.

| Stored state / operation | Result |
| --- | --- |
| Any no-show or all bookings cancelled; change date/time/duration/tutor/room/mode | Reject `SESSION_NOT_EDITABLE`, even when the same request changes status or includes bookings |
| Same protected session; update note or cancel booking without moving | Allowed; source identity and snapshots are retained |
| Booked -> no_show | Resource-consuming status correction; validate the resulting schedule |
| Booked/no_show -> cancelled | Release only that student's occupancy; cancellation alone remains possible on historical conflicts |
| Cancelled -> booked/no_show, or no_show -> booked | Same student only; revalidate the complete affected session, set cancelledAt to null, record reason and before/after audit |
| Restore and move a protected session in one request | Rejected; a successful status correction must be saved separately before a later reschedule |
| Directly change an existing booking's studentId | Rejected; use replacementStudentId instead |
| Replace a participant | Cancel the old booking and insert a fresh booked participant in the same transaction; validate occupancy and tutor load before either change commits |

These are manual booking-status corrections within the scheduling editor, not a separate attendance workflow. Source notes remain attached to the same student. Previous cancellation timestamps/reasons remain available in audit snapshots after a valid restoration. Server checks run under the existing transaction lock after the version check; UI locks are explanatory, not authorization.


### Single write path

1. Validate input shape.
2. Begin a `READ COMMITTED` transaction and acquire the same `pg_advisory_xact_lock` for every scheduling mutation.
3. After acquiring the lock, read current state and check entity existence, version, eligibility, and applicable business rules.
4. Compare the proposed session against relevant active sessions, excluding its old representation. Count its proposed active bookings exactly once in tutor load.
5. Write records, increment the existing session version, and append history atomically. New sessions begin at version 1.
6. Commit; return committed IDs/version so the UI can refresh.

The global lock is suitable for this small app and protects cooperating application writes. It does not prevent arbitrary SQL from bypassing validation. Keep transactions short; no external service calls inside them.

API errors: 400 for invalid input, 404 for missing entities, 409 for business conflicts/stale versions. Return a code, useful message, field details where relevant, and related record IDs. Unexpected failures receive sanitized server errors; never expose SQL or secrets. Repeated cancellation returns a clear conflict and creates no duplicate audit event.

### Existing invalid data

- Read and show warnings normally.
- Creation or edits to scheduling fields must make the affected session valid. Do not require unrelated historical records to be repaired first.
- **Explicit limitation:** if T1 still has seven active bookings that day, changing only one session's room is rejected because its resulting tutor-day load remains invalid. Explain this in the error. Moving it to a valid tutor/day or cancelling a booking can resolve the load.
- “Allow any edit that does not worsen a violation” is deferred; it requires additional comparison rules and tests. Do not implement it implicitly.
- Cancellation remains allowed when historical scheduling rules are violated.
- Do not reschedule a fully cancelled session or one containing `no_show`, based on stored state. A separate status correction may restore occupancy only after validation.

### Cutoff and change visibility

Cutoff is 16:00 on the local day before the lesson. Use `occurred_at >= cutoff` as the explicit boundary interpretation. When changing dates, evaluate both old and new cutoffs; reaching either marks the change after cutoff.

Record before/after snapshots for every application change, including late creation and cancellation. Do not invent seed history. An After cutoff badge does not mean the tutor has been notified.

**Moves must leave visible history on both the old and new day.** The daily GET must retrieve changes by old/new snapshot date, not only through sessions currently scheduled on that date. A moved-away session should leave a “Moved to…” entry on its original day.

Reject a bulk-save-whole-table endpoint: it makes per-operation errors harder to explain and increases stale overwrite risk. Document this choice in `DECISIONS.md`.

## 5. Delegation and integration order

Bao authorized implementation; the following ownership boundaries continue to apply. During implementation, the coordinator owns scaffold, dependencies, schema/seed, shared contracts, API/transactions, integration, documentation, and authorized commits. Subagents must not modify contracts, package files, migrations, or Git history.

| Agent | Independent responsibility | Deliverable |
| --- | --- | --- |
| UI | Board, filters, forms, warnings/history against agreed contracts | Components; clearly temporary contract-compatible fixtures initially |
| Domain/test | Pure overlap, load, pair, occupancy, cutoff logic and tests | Helpers, focused tests, scenario list |
| Reviewer | Read-only review after integration | Findings by severity, brief compliance, unverified evidence |

Agents inherit coordinator settings. Only the coordinator runs heavy checks, stages, or commits. Avoid overlapping file ownership.

### Proposed remaining-work allocation

These estimates total **105 minutes**, not a guaranteed remaining budget. Reconcile them with the 150-minute total and actual time already spent before starting.

| Phase | Target | Work / exit condition |
| --- | ---: | --- |
| Foundation | 15 min | Scaffold, contracts, initial DECISIONS.md, authorized dedicated DB setup; contracts ready and DB status explicit |
| Independent work | 45 min | Coordinator DB/API; UI and domain work in parallel after contracts exist |
| Integration | 25 min | Connect real API, run sequential checks, resolve defects; fixtures are not a completion fallback |
| Review/handoff | 20 min | Read-only review, documentation, critical-path explanation, small commits if authorized |

Use any actual remaining slack as buffer, not additional feature scope. If DB access is blocked, continue useful independent UI/domain work and report the exact blocker. Never quietly substitute mocks and call the feature complete. Do not compromise conflict checks, atomicity, or honest evidence to fit polish into the timebox.

## 6. Verification and handoff

### Required acceptance checks

- Full seed import with preserved source data and expected entity counts; pair causes no false tutor/room overlap.
- All identified historical violations are detected without mutating the source data.
- Student, tutor, and room overlaps are blocked; adjacent sessions are allowed.
- Sixth active student booking allowed, seventh rejected; pair counts two; cancelled excluded.
- Monday, unsupported duration, and out-of-hours sessions blocked; exact opening boundaries covered.
- Pair requires distinct students; one-to-one exactly one; existing booking identity cannot change; adding a distinct second booking for a pair is supported.
- Last cancellation releases shared resources; first pair cancellation does not; no-show remains resource-consuming.
- Cancellation works on invalid historical data; room-only edit on a still-overloaded tutor-day is rejected with a clear reason.
- Fully cancelled/no-show sessions cannot be rescheduled; repeated cancellation does not duplicate history.
- Two concurrent conflicting creates result in exactly one success.
- Stale versions return 409; forced transaction failure leaves no partial session/bookings/audit.
- Cutoff tests cover before, exactly at, and after the boundary, creation/cancellation, and both old/new dates on moves.
- Before/after history remains visible on both affected dates even after the session moves away.
- Seed rerun does not duplicate records and preserves an intervening user edit.
- Filtered-out records still contribute to conflict checks.
- Draft survives failure, pending submission is locked, and no success appears before commit confirmation.
- Confirmed save plus failed refresh is distinct from a rejected write; unknown write outcome does not trigger blind retry.
- Today uses the fixed clock; initial March 4 view and date navigation do not change now.

Unit tests cover pure logic. Integration tests use a verified separate test database/schema, never the demo seed schema, and prove concurrency/rollback rather than substituting mocks for that evidence.

Run typecheck and tests sequentially through `/Users/bao/.codex/bin/heavy-node`, inspecting `heavy-node-status` first. Use one Vitest worker. No automatic build or server startup. Do not claim browser verification unless requested and performed. Record actual commands/results and distinguish source, tests, DB, browser, build, commit, push, and deployment evidence.

### Handoff documents

- `DECISIONS.md`: discovery questions and consequences; contradictions/assumptions; roughly six candidate features; why exactly one was chosen; data model/API; database-versus-code enforcement; rejected bulk endpoint; known limitations including strict historical edits; next week; actual AI contributions and one suggestion genuinely rejected with rationale.
- Root `README.md`: prerequisites, env, actual migration/seed/run/test commands, fixed demo clock, useful source scenarios, observed verification results and limitations.
- `AGENTS.md`: execution boundaries and ownership. `DESIGN.md` (visual design) and `TECHNICAL_DESIGN.md` (business/technical design): supporting design detail. Neither replaces the submission's DECISIONS.md or README.
- Small local functional commits with what/why messages once authorized; keep history and do not squash. Push/submission only when Bao requests it.

Before handoff, explain two paths to Bao:

1. Create: user fills draft -> API validates -> lock/fresh conflict checks -> session, bookings and audit commit -> UI refreshes; explain invalid input, conflict, load, transaction failure and ambiguous network outcome.
2. Cancel: user selects one student's booking and reason -> lock/version check -> status, session version and snapshot commit -> UI refreshes; explain retained pair occupancy, last-booking release, stale version and already-cancelled state.

### Progress ledger

- [x] Download four originals into ref/ and verify their byte sizes.
- [x] Read both rendered PDF pages, README, and CSV data.
- [x] Prepare English repository instructions and supporting design.
- [x] Adopt Bao's supplied plan as this master plan with review corrections.
- [x] Receive implementation instruction: public synthetic demo, no login; do not claim the user's 20-minute estimate as a measured duration.
- [x] Confirm dedicated Bright Path project and isolated bright_path_test schema.
- [x] Complete foundation and shared contracts.
- [x] Implement domain, database/API, and UI workstreams.
- [x] Original implementation checkpoint: typecheck, 27 domain tests, 7 PostgreSQL tests and initial deployment. These historical results do not cover later edits; see README for the latest review checks.
- [x] Review and finish handoff documents; create/cancel paths are documented and explained in the handoff.
- [x] Local functional commits through `6d4dae6`; push/submit only upon request.

## Deployment checkpoint

Live public demo: https://bright-path-scheduling.vercel.app. Runtime DATABASE_URL was explicitly approved as a Vercel Production Secret; owner/test credentials remain local. Local application commits now exist through `6d4dae6`. No push or deployment of the current review fixes was performed in this task. The original CLI deployment was made from an uncommitted working tree; its exact commit cannot be established from the available evidence. Do not label it as deployment of HEAD. Historical browser and seed-rerun evidence is recorded separately in README.


Participant replacement (approved 16 September 2026): reception can select a new student in the same session. The request retains the old studentId/id and supplies replacementStudentId. The old booking is cancelled (an existing cancellation timestamp/reason is preserved), a new booking is created, and the session version plus before/after audit are committed atomically. Schedule and peer bookings are unchanged unless separately edited. A conflicting replacement or stale version writes nothing. A student who already has a retained booking in that session must use their existing booking's status correction instead, avoiding duplicate identity. The main board and filters use active participants where present; cancelled participants remain accessible in session details, the collapsed editor history and audit. No record is deleted.
