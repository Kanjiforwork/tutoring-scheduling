# Bright Path: Daily Scheduling Board Design

> Current authorization (2026-09-16): Bao approved implementation with Astra medium agents, a dedicated Supabase database, and Vercel hosting. This is a public synthetic-data demo with no login, explicitly requested by Bao; anyone with the link can change demo schedules. Earlier planning-only/local-only statements below describe the previous stage and are superseded by this authorization. No real student data or product database is used. The runtime connection secret requires the separate deployment approval recorded in the task.


Status: implemented design, updated during the 2026-09-16 review. README separates current verification from historical deployment evidence.

## 1. Evidence and problem

Sources: the visually reviewed two-page `ref/01-tutoring-scheduling.pdf`, `ref/README.txt`, and both CSV files. The PDF's extracted text is corrupted by its font; rendered pages are authoritative.

Bright Path is a tutoring centre in Da Nang with 12 tutors, fewer than 200 families, and six rooms. Mai operates a shared spreadsheet and WhatsApp groups and will go on leave in eight weeks. Student double-booking is unacceptable. Tutors receive competing versions of their day and sometimes travel to cancelled lessons. The owner wants an immediate view of today.

The README says this is a tidied export taken on 2026-03-10: every row parses and every identifier resolves, but actual operations do not always satisfy the rules. These are historical business violations, not corrupt input to repair.

Selected feature: reception can inspect a day's sessions, create or reschedule a session, and cancel a student's booking, with precise conflict feedback and visible changes after cutoff.

Success criteria: all 34 source bookings remain inspectable; known violations are visible; invalid new writes are rejected without partial data; legitimate pairs and adjacent sessions work; Bao can explain and modify the full critical path. These are acceptance targets, not measured results.

## 2. Prioritization

| Candidate | Decision |
| --- | --- |
| Daily board with safe scheduling and change history | Selected: prevents the owner's most serious failure while giving reception one usable operational view |
| Tutor notification and acknowledgement | Deferred: visibility alone does not prove a tutor received a change |
| Cancellation billing and tutor pay | Deferred: policy exceptions are unresolved and money requires separate rules |
| Waitlist and freed-slot refill | Deferred: useful after reliable cancellation and availability exist |
| Recurring scheduling | Deferred: expands edit scope and collision handling substantially |
| Tutor/student/room administration | Deferred: existing catalogs suffice for the assessment |

The selected feature deliberately leaves messaging fragmentation and billing manual. No claim that audit history fixes notification delivery.

## 3. Source rules, interpretations, and open questions

| Topic | Evidence / v1 decision | Discovery question and impact |
| --- | --- | --- |
| Opening days | PDF: Tuesday-Sunday; Monday closed | Are holidays or exceptional opening days needed? Would require an availability calendar |
| Opening hours | PDF says mid-morning to mid-evening; **09:00-22:00 is our assumption**, covering observed seed times | Exact hours? Change one shared configuration and boundary tests |
| Duration | PDF: 60 or 90 minutes | No further duration choices in v1 |
| Pair lessons | PDF calls lessons one-to-one, but Mai explicitly describes intentional pairs; L009/L010 confirm one | Are pairs official and what capacity applies? v1 supports exactly two distinct students |
| Tutor load | PDF: maximum six bookings/day; v1 counts non-cancelled student bookings, so a pair counts two | Does booking mean student or session? A different answer changes the load validator |
| Cancellation | PDF: cancelling frees resources; no-show does not | In a pair, v1 frees shared resources only when the last active booking is cancelled |
| Late cancellation | PDF: free until four hours before start; inside that window full charge and tutor paid | L017 says tutor sick; does the family still pay? Record as unresolved, implement no billing |
| Cutoff | PDF: tomorrow's schedule final at 16:00 today; later changes must remain visible | What proves the tutor was told? v1 records changes, not delivery/acknowledgement |
| Identity | CSV has student names, not IDs | Real duplicate names need identity resolution; name mapping is limited to this synthetic import |
| Catalog size | PDF describes 12 tutors; export contains 3 | Seed only the 3 supplied tutors; do not invent 9 people. Create R1-R6 per the PDF |

Use half-open intervals `[start, end)` so an end at 10:00 permits a start at 10:00. Both start and end must lie within opening hours on the same local day. `booked` and `no_show` occupy the student, tutor, and room; `cancelled` occupies none.

## 4. Clock and historical data

- Timezone: `Asia/Ho_Chi_Minh`.
- Demo now: `2026-03-03T17:00:00+07:00`.
- Initial viewed date: `2026-03-04`, intentionally tomorrow to show the known student conflict and pair immediately. This differs from a literal today-first landing page; Today returns to March 3 using the demo clock.
- Display the demo clock separately from the selected date. Never use the host's real date for scheduling decisions.
- This clock is an assessment device, not an as-of historical reconstruction: the March 10 export includes later statuses and cancellations. Preserve them without pretending they were known on March 3.
- No blanket past-session restriction is introduced in v1. Disallow scheduling-field changes to fully cancelled sessions or sessions containing a no-show, based on stored state. Permit note updates and separate status corrections under the editor policy below.

Verified source inventory: 34 bookings, 3 tutors, 6 distinct student names, dates March 3-10. Pairing only L009/L010 yields 33 sessions. Keep original lesson IDs and notes.

| Source records | Expected reading |
| --- | --- |
| L007 / L008, March 4 | Same student at 09:00 in different sessions: student conflict |
| L009 / L010, March 4 | Explicit exam pair: one session, no false tutor/room conflict |
| T1, March 6 | L018, L021, L022, L024-L027: seven active bookings, exceeding six |
| L015 | No-show still occupies its interval |
| L005 / L017 | Cancelled bookings do not occupy resources; retain cancellation data |
| L032, March 9 | Monday booking: closed-day warning; note is not a complete move audit |
| L033 / L034, March 10 | T1 in two rooms at 09:00: tutor conflict, not an intentional pair |

Seed must insert missing known source entities deterministically and transactionally, without duplicating rows or overwriting user edits on rerun. Preserve historical violations; do not infer pairs from matching time alone. Do not invent audit events for seed records.

## 5. Screen and interaction design

One English-language screen, built for a busy receptionist on a laptop. Use a compact neutral surface, clear typography, a single primary Add session action, and restrained status colors with text labels. No decorative dashboard charts or unrelated cards.

1. Header: Bright Path, selected date, Previous / Next / Today, visible demo-clock label.
2. Toolbar: tutor and student filters, Add session; show a clear empty-filter result.
3. Daily table: Time, Students, Tutor, Room, Status, Warnings, Actions. Sort by start time with a stable secondary ID.
4. One row per session. Pair students appear together with individual status and cancellation controls. Keep historical and cancelled records visible.
5. Expand warning details to identify the conflicting session, lesson ID, time, and resource. Filtering must not suppress conflict detection; warn even when the other record is hidden by a filter.
6. Create/edit form: date, start, duration (60/90), tutor, room; create additionally chooses one-to-one/pair and students. Edit preserves existing booking/student identity, supports a new second booking for pair conversion, and permits audited status corrections. Explain that a pair edit affects both students; require an edit reason.
7. Cancellation confirmation: name the student and session, require a reason, explain whether the other student keeps the room/tutor occupied.
8. Change details: action, reason, demo timestamp, before/after values, and After cutoff badge. Clearly state that the badge is not a notification receipt.

Loading, empty day, failed fetch with Retry, inline validation, conflict details, and stale-version messages are first-class states. Keep form values on failure. Disable repeated submission while saving. Show success only after commit confirmation. If commit succeeds but refresh fails, say the save succeeded and offer a reload; do not imply rollback or encourage a blind retry.

On narrow screens, preserve the same session grouping with stacked rows or a contained horizontally scrollable table; keep names, status, and actions usable. Use labeled controls, keyboard-operable dialogs, visible focus, and warning text rather than color alone. No drag-and-drop.

## 6. Architecture and data model

Planned stack: Next.js App Router + TypeScript + Tailwind; Zod for request validation; Postgres.js for server-only SQL; PostgreSQL hosted in a dedicated Supabase assignment project; Vitest for pure and integration tests. Use npm and commit its lockfile. No ORM or browser database client.

Flow: UI -> Next.js route handler -> validation/service -> PostgreSQL transaction -> committed response -> schedule refresh. Share typed DTOs between UI and API, but keep database credentials and repository code in server-only modules.

| Table | Core fields and purpose |
| --- | --- |
| students | Internal ID, display name; name is not globally unique |
| tutors | Source tutor ID, name, subject, phone |
| rooms | Stable ID R1-R6 |
| sessions | ID, starts_at, ends_at, tutor_id, room_id, mode, version |
| bookings | ID, session_id, student_id, status, cancelled_at, cancellation_reason, unique nullable source_lesson_id, source_note |
| schedule_changes | ID, session_id, optional booking_id, action, before/after JSON snapshots, demo occurred_at, reason, after_cutoff |

Store instants consistently and derive dates/cutoffs in the centre timezone. Snapshots include session fields and booking statuses/IDs so pair cancellations and moves remain understandable after later edits. Query changes relevant to either the old or new local date, so a moved-away session still leaves a trace on its old day.

Database constraints: primary/foreign keys, required fields, permitted statuses/modes, positive version, 60/90-minute duration, unique `(session_id, student_id)`, unique source lesson IDs. Application transaction checks: opening day/hours, active overlap, daily load, pair cardinality at creation, edit eligibility, version, and audit policy. Do not impose whole-table overlap/day/load constraints that reject the required historical seed.

Use a private schema excluded from Data API exposure, server-only `.env.local`, and `.env.example` placeholders. Verify grants/exposure during setup. Public no-login hosting of this synthetic demo was explicitly approved. Latest local changes are not automatically deployed; see README for verification boundaries.

## 7. API contract outline

| Endpoint | Input / result |
| --- | --- |
| GET /api/schedule?date=YYYY-MM-DD | Sessions and per-student bookings, catalogs, related warnings, relevant change history, demo clock and timezone |
| POST /api/sessions | Date, local start, duration, tutorId, roomId, mode, studentIds; atomic creation; record reason if provided |
| PATCH /api/sessions/:id | Schedule fields, optional mode/note/bookings, expectedVersion, required reason; immutable existing booking/student identity |
| POST /api/bookings/:id/cancel | Session expectedVersion and required reason; cancel one booking |

Writes return committed identifiers/version. Final DTOs are a prerequisite for parallel implementation. Errors use an envelope containing code, message, optional field errors, and related session/booking/source IDs. Use 400 for malformed input, 404 for missing entities, 409 for business conflicts or stale versions, and a sanitized server error for unexpected failure. Never return SQL or secrets.

Rejected endpoint: bulk-save the whole schedule. It increases overwrite risk and makes individual conflict recovery harder. Catalogs are read-only options; no additional CRUD API.

## 8. One write transaction

1. Parse and validate the request shape; reject invalid input before opening a transaction.
2. Begin `READ COMMITTED`; acquire the same `pg_advisory_xact_lock` for every application scheduling write.
3. After obtaining the lock, read fresh session/bookings and check existence, expected version, and edit eligibility.
4. Build the proposed state. For create/edit, validate against all relevant active sessions, excluding the current session from comparisons. Daily load includes the proposed active bookings once.
5. Reject if the affected session would remain invalid. Do not force unrelated historical records to be fixed first. Cancellation may proceed even if the old session is invalid.
6. Write session/bookings, increment an existing session's version, and insert an audit snapshot in the same transaction. A new session starts at version 1.
7. Commit, then respond; UI refreshes authoritative data.

The global lock is a deliberate small-scale simplification: it serializes cooperating application writes. It does not stop arbitrary SQL from bypassing these checks. Keep transactions short and avoid external calls inside them.

For an already cancelled booking, return a clear conflict without adding another cancellation audit. A stale request must not overwrite a newer edit. A transaction failure must leave neither partial bookings nor a partial audit.

Cutoff is 16:00 on the local day before a session. Use `occurred_at >= cutoff` as the explicit boundary interpretation. Moves consider both old and new cutoffs; reaching either marks the change after cutoff. Include late creations and cancellations. Store all changes, not only late ones. This clock does not certify notification delivery.

## 9. Critical paths and limits

Create: receptionist fills form -> UI preserves draft while submitting -> API validates -> lock and fresh conflict checks -> session plus one/two bookings plus audit commit together -> UI refreshes and renders the new row. Failure cases: invalid input, overlap, daily load, closed day, database/network failure, ambiguous response after a successful commit. Do not automatically retry an ambiguous create; refresh first.

Cancel: receptionist selects one student's booking and gives a reason -> API locks and checks session version -> booking becomes cancelled, version increases, audit records before/after -> UI refreshes. The tutor and room are released only if no active booking remains. Stale version and already-cancelled state return clear conflicts; historical scheduling violations do not block cancellation.

Known limits: no authentication, notification acknowledgement, billing, recurrence, undo, automatic source-data repair, or protection against direct SQL bypass. Global serialization trades throughput for explainability. Assess these honestly in `DECISIONS.md` after implementation, using actual evidence rather than predicted success.

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


Participant replacement (approved 16 September 2026): reception can select a new student in the same session. The request retains the old studentId/id and supplies replacementStudentId. The old booking is cancelled (an existing cancellation timestamp/reason is preserved), a new booking is created, and the session version plus before/after audit are committed atomically. Schedule and peer bookings are unchanged unless separately edited. A conflicting replacement or stale version writes nothing. A student who already has a retained booking in that session must use their existing booking's status correction instead, avoiding duplicate identity. The main board and filters use active participants where present; cancelled participants remain accessible in session details, the collapsed editor history and audit. No record is deleted.
