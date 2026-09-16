# Bright Path scheduling

A daily reception board for arranging lessons, checking conflicts, and keeping visible change history. Reception manages the schedule for students and tutors. This is scheduling, not attendance, payroll, or billing.

The approved deployment is a **public, no-login demonstration with synthetic assignment data** on Vercel and a dedicated Supabase PostgreSQL database. Anyone with the link can change demo bookings. Do not enter real student or family information. [Open the live demo](https://bright-path-scheduling.vercel.app).

## Stack and structure

Next.js 16.3.5 App Router, React 19.3.0, TypeScript 7.0.2, Tailwind CSS, Zod, Postgres.js 3.4.9, and Vitest. There is no ORM or browser-side database client.

- `src/components/scheduling-board.tsx`: daily board and create/edit/cancel dialogs.
- `src/lib/domain.ts`: pure occupancy, overlap, tutor load, and cutoff rules.
- `src/lib/server/`: validation, database access, transactional writes, and HTTP errors.
- `scripts/`: schema template, migration runner, and deterministic CSV import.
- `supabase/migrations/`: dedicated project provisioning migration, including role grants and RLS.
- `ref/`: unchanged assignment sources. The PDF's custom font makes extracted text unreliable; read its rendered pages.
- `DECISIONS.md`: product choices, assumptions, limitations, and AI reflection.

## Setup

Use Node.js 22.20 or newer and npm. The committed lockfile pins dependencies. Local application history includes commits through `6d4dae6`, including the reviewed booking replacement and conflict UI changes.

```sh
npm ci
cp .env.example .env.local
```

Fill server-only variables in ignored `.env.local`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase transaction-pooler connection for `bright_path_app` |
| `DB_SCHEMA` | `bright_path` |
| `MIGRATION_DATABASE_URL` | Separate schema-owner connection for migration and seeding; add this key to `.env.local` |
| `TEST_DATABASE_URL` | Separate test-runner connection, never the application runtime connection |
| `TEST_DB_SCHEMA` | `bright_path_test` |

Never prefix these variables with `NEXT_PUBLIC_`, print credentials, or commit environment files. Only the runtime connection and `DB_SCHEMA` belong in Vercel's application environment; owner/test credentials remain local.

The dedicated Supabase project is `qiaprmgnviavgmfhjwza`. Its provisioning migration has been applied. The application schema is private, `anon` and `authenticated` have no schema usage, and RLS policies are scoped to database roles. The runtime role has no access to the isolated test schema. These controls protect direct database access; they do not authenticate users of the intentionally public application API.

For a new dedicated project, provision the roles and grants described in `supabase/migrations/20260916072910_scheduling_schema.sql` with administrator authorization first. Role credentials must be established securely outside version control. `scripts/schema.sql` alone is a table/schema template, not the full role provisioning procedure.

For an authorized schema setup and import:

```sh
npm run db:migrate
npm run db:seed
```

Migration requires `MIGRATION_DATABASE_URL`. Seed uses that owner connection when provided, takes the scheduling lock, and inserts source records transactionally. Reruns preserve existing records and edits; this is not a reset command. The verified initial import contains **33 sessions, 34 bookings, six students, three tutors, and six rooms**. L009/L010 share one pair session; all other source lessons remain separate.

## Run and verify

```sh
npm run dev
```

For an explicitly requested production build:

```sh
npm run build
npm run start
```

Next.js normally uses port 3000; use the URL printed by the process. Agents must obey the repository's server authorization and global heavy-command guard instructions. Commands here are manual operator instructions, not authorization to start a server or build automatically.

Run checks sequentially:

```sh
npm run typecheck
npm test
npm run test:integration
```

Vitest loads local environment settings. Integration tests require `TEST_DATABASE_URL` and `TEST_DB_SCHEMA=bright_path_test`; without a test URL the suite is skipped. They create uniquely named fixtures in the isolated schema and retain them rather than deleting data. They test concurrent collisions, stale versions, pair cancellation, no-show occupancy, historical overload, cross-day history, and transaction rollback.

Historical initial-deployment checkpoint (recorded during the original implementation; not rerun for every subsequent change):

- 27 domain tests passed.
- Typecheck passed after the UI review fixes.
- All seven PostgreSQL integration tests passed against the isolated schema (47 seconds).
- Seed rerun check passed in the isolated test schema: 34 unique source bookings and a manually edited test note survived a second import.
- Provisioning migration applied and initial seed counts verified. Supabase Security Advisor returned no findings; runtime dependency audit returned zero vulnerabilities.
- Vercel production build and deployment passed. Public GET returned the expected March 4 schedule. Browser confirmed conflict rejection with a preserved draft, valid creation, room edit, cancellation, and three audit entries. Desktop/laptop (1512/1280px) and mobile (390px) were visually inspected; tablet (900px) and mobile reported no horizontal page overflow.

## Demo walkthrough

The clock is fixed at **3 March 2026, 17:00, Asia/Ho_Chi_Minh (UTC+7)**. The initial board shows March 4. Viewing another date does not change the clock. This is a demonstration clock, not a historical reconstruction of what was known on March 3.

| Day / source | What to inspect |
| --- | --- |
| March 4, L007/L008 | One student booked into overlapping sessions |
| March 4, L009/L010 | Intentional pair, with individual student statuses and cancellation |
| March 6, T1 | Seven active student bookings; daily-load warning |
| L015 | No-show still reserves resources |
| L005/L017 | Cancelled bookings retain notes/timestamps and release resources |
| March 9, L032 | Historical Monday booking remains visible with a warning |
| March 10, L033/L034 | Tutor overlap across two rooms |

Create a session using a free tutor/room/student interval. Try an overlapping interval to see a specific rejection. Cancel one pair booking: the other student keeps the room and tutor reserved. Cancel the last active booking: those resources become free. Move a session to another day: both days retain a before/after history entry.

## Critical path

Creating or editing a session sends the form to a Next.js API route. Zod validates its shape; the server takes a transaction-scoped advisory lock, reads the current database state, checks the version for edits, and evaluates scheduling rules. The session/bookings and before/after audit commit together. The UI then reloads the schedule. A conflict or stale version makes no partial write.

Cancellation checks the same lock and session version, changes one booking's status, increments the session version, and records an audit in one transaction. It remains possible on invalid historical data. Shared resources are free only when no active booking remains. Confirmed save plus failed refresh is reported separately from an unknown write outcome; an unknown outcome must be reconciled before another submission.

There is no notification delivery, login, undo, recurring scheduling, billing, or automatic repair of imported violations. The editor supports notes, status corrections (including validated restoration), and pair conversion. Students can be replaced inside a session: the old booking is cancelled and retained, and a fresh booking is created for the new student atomically. Stored booking identities are never reassigned. See TECHNICAL_DESIGN.md for exact transition rules.

A browser smoke-test booking on March 11 was created, edited, and cancelled with explicit test reasons. Its cancelled row and three history entries remain; the original 34 source bookings were not modified.

Additional seed verification command:

```sh
npx tsx --env-file=.env.local scripts/verify-seed.ts
```

Verification limits: no full accessibility audit, simulated network-failure browser test, or long-running load test. Runtime dependency audit found zero vulnerabilities; the installed development/deployment CLI dependency tree reported transitive advisories during installation. The initial checkpoint preceded local commits; local history now exists through `2202db4`. No push of the current review fixes was performed in this task.

Deployment evidence boundary: the historically verified daily-board deployment is `dpl_DTaahiKCnCqFjtsGBuXfNo1taJMJ`. App-source hashes were unchanged across its build. Subsequent concurrent workspace changes introducing a calendar/month view were observed after deployment and are not included in this deployment's browser-verification claims.


## Current review checkpoint — 16 September 2026

Baseline: local commit `2202db4`, plus subsequent uncommitted review fixes. The initial CLI deployment was created from an uncommitted working tree; its exact Git commit is not established. The deployment ID above is a historical reference, not evidence of the current source being live. No new deployment or build was performed for this review.

- Typecheck passed after the server policy and editor locks were changed.
- 70 unit tests passed across 8 files, including UI-shaped payload regressions for no-show/cancelled schedule changes, simultaneous restoration and move, immutable booking identity, and note-only edits.
- All 11 PostgreSQL integration tests passed against the isolated bright_path_test schema (77 seconds). The first sandbox attempt failed DNS resolution before running tests; the network-enabled run completed successfully. No demo records were used as test fixtures.
- Browser checks on the existing local server verified L015 no-show and L017 cancelled: scheduling fields are disabled; status and note remain available; cancellation source details remain visible. No browser write was submitted for this check. Earlier browser checks verified compact conflict details at desktop and 390px mobile widths.
- No migrations or source-reference changes were needed. DECISIONS.md was not edited.

The server checks stored state after version validation and before any write. A blocked move or conflicting replacement leaves both the schedule and audit unchanged. Cancellation and note-only edits remain possible on imported conflicts. Restoring a booking validates occupancy and tutor load before committing; the UI refreshes only after confirmation. A lost response still requires reconciliation before retrying.


### Participant replacement follow-up

The editor now supports replacing a student without recreating the session. It sends replacementStudentId against the original booking; the server cancels that booking and inserts a fresh booked record under the same transaction lock. Original source notes and cancellation details are not copied to the newcomer. Pair peers keep their bookings and active capacity remains two even after multiple replacements. Cancelled participants remain in details/history; the board shows active names when present. A previously booked student cannot be inserted twice into the same session: use their retained booking to restore them.

74 unit tests passed across 9 files; typecheck passed. All 13 PostgreSQL integration tests passed on bright_path_test (101 seconds), including repeated pair replacements, retained peer/source data, stale-version rejection and conflict rollback with unchanged audit. Browser verified replacement selection, before/after preview and the reason dialog without submitting a write to the demo. No migration, commit, build, or deployment was performed for this follow-up.


## Local commit checkpoint

Application changes are committed through `6d4dae6`: warning fallbacks (`1be4c41`), transaction and booking identity fixes (`29460ba`), and editor/conflict presentation (`6d4dae6`). Typecheck, 74 unit tests and 13 isolated PostgreSQL integration tests passed for these changes before commit. The earlier uncommitted checkpoints above describe when their checks were recorded. No push or new deployment was performed; the historical production deployment is not a deployment of this commit.


History navigation: audit entries now live on `/history`, reached through the shared Schedule / History navigation. The selected lesson date carries across both pages. History includes date navigation, refresh/retry, empty state, cutoff badges, and expandable before/after snapshots. Moving a session still appears for both its old and new lesson dates. The schedule page no longer embeds the history accordion. This is a separate view of the existing audit feature, not a new write workflow.


Closed-day confirmation follow-up: Monday create/edit saves now ask for explicit confirmation in a separate dialog. The server waives only CLOSED_DAY and records confirmation in the audit reason; overlaps, operating hours, duration and tutor load still apply. Typecheck, 77 unit tests and 14 isolated PostgreSQL integration tests passed (116 seconds for integration). Browser verified the create confirmation and Back to editing preserving the draft, without writing demo data.

Production checkpoint — 16 September 2026: deployment `dpl_2HeAxP4coe9S7dn3YDe94Hwc34Dh` is ready at https://brightpathscheduling.vercel.app. Vercel production build and TypeScript checks passed. Homepage, `/history`, and read-only `/api/schedule` returned HTTP 200. Application-source hashes remained unchanged during deployment. This deployment includes History navigation and confirmed Monday exceptions; it was deployed from the working tree before the accompanying local commit.
