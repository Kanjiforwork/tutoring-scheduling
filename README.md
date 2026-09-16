# Bright Path scheduling

Live demo: [https://brightpathscheduling.vercel.app/](https://brightpathscheduling.vercel.app/)

Bright Path is a reception scheduling board for lessons, tutors, students, rooms, conflict checks, and change history. It is a public demo using synthetic data; anyone with the link can edit it. Do not enter real student or family information.

## What it supports

- Daily schedule with week and month views, filters, and a separate History page.
- One-to-one and pair lessons, with student-level booking status.
- Conflict checks for students, tutors, rooms, opening hours, duration, and tutor daily load.
- Historical violations remain visible as warnings instead of being silently repaired.
- Monday lessons can be saved after a separate confirmation; other conflicts still block the save.
- Cancellation, no-show, notes, status corrections, student replacement, and before/after audit history.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Zod, Postgres.js, PostgreSQL/Supabase, and Vitest. The browser talks to the Next.js API; database writes use transactions, version checks, and an advisory lock. There is no ORM, login, billing, attendance workflow, recurring scheduling, or notification delivery.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set these server-only variables in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime connection for the `bright_path` schema |
| `DB_SCHEMA` | Application schema, normally `bright_path` |
| `MIGRATION_DATABASE_URL` | Owner connection for migrations and seed |
| `TEST_DATABASE_URL` | Separate integration-test database |
| `TEST_DB_SCHEMA` | Test schema, normally `bright_path_test` |

Never commit `.env.local` or expose database variables with `NEXT_PUBLIC_`.

## Database setup

For an authorized dedicated Supabase project:

```sh
npm run db:migrate
npm run db:seed
```

The seed imports the assignment data and preserves existing records on rerun. `scripts/schema.sql` is only a schema template; the full role and grant setup is in `supabase/migrations/`.

## Verify

Run checks sequentially:

```sh
npm run typecheck
npm test
npm run test:integration
```

Integration tests require the separate test database variables. They cover conflicts, stale versions, pair bookings, cancellation, no-show occupancy, historical violations, replacements, audit history, and transaction rollback.

## Demo data and rules

The demo clock is fixed at **3 March 2026, 17:00, Asia/Ho_Chi_Minh (UTC+7)**, and the first schedule view is March 4. The imported dataset intentionally contains examples such as overlapping lessons, a pair lesson, excessive tutor load, a Monday booking, and cancelled/no-show bookings.

Important rules:

- Booked and no-show bookings consume tutor, room, and student availability; cancelled bookings do not.
- A pair is one session with two distinct bookings and counts as two active tutor bookings.
- Existing booking identity is preserved. Replacing a student cancels the old booking and creates a new one atomically.
- Every successful change records before/after snapshots and a reason where applicable.

Reference material remains unchanged in `ref/`. Product assumptions and trade-offs are recorded in [`DECISIONS.md`](DECISIONS.md); detailed business and technical rules are in [`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md).
