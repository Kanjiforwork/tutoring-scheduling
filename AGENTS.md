# Bright Path: Agent Instructions

> Current authorization (2026-09-16): Bao approved implementation with Astra medium agents, a dedicated Supabase database, and Vercel hosting. This is a public synthetic-data demo with no login, explicitly requested by Bao; anyone with the link can change demo schedules. Earlier planning-only/local-only statements below describe the previous stage and are superseded by this authorization. No real student data or product database is used. The runtime connection secret requires the separate deployment approval recorded in the task.


## Current stage and source of truth

This repository is in pre-implementation planning. Reference acquisition and documentation are authorized; application implementation must wait for Bao's approval of the plan. Do not scaffold, install dependencies, provision a database, run migrations, build, or start a server merely because these documents describe future work.

Read, in order:

1. `ref/01-tutoring-scheduling.pdf`, visually, including both pages. Its custom font makes extracted/copied text unreliable.
2. `ref/README.txt`, `ref/lessons_export.csv`, and `ref/tutors.csv`.
3. `DESIGN.md` (visual design) and `TECHNICAL_DESIGN.md` (business/technical design) for product and technical decisions.
4. `MASTER_PLAN.md` for execution order, acceptance checks, and current status.

The source brief describes the assignment; the design labels our interpretations and assumptions. Never silently resolve a discrepancy by changing the source files. Keep all four files in `ref/` unchanged. `DESIGN.md` (visual design) and `TECHNICAL_DESIGN.md` (business/technical design) and `MASTER_PLAN.md` do not replace the assignment's eventual `DECISIONS.md` and runnable-project `README.md`.

## Product and engineering boundaries

- Build exactly one feature: a daily reception scheduling board with conflict checks and visible change history.
- Use English for the UI and repository documentation. Explanations to Bao can be Vietnamese.
- Planned stack: Next.js App Router, TypeScript, Tailwind CSS, Zod, Postgres.js (`postgres`), PostgreSQL, Vitest, and npm with a committed lockfile. No ORM.
- Separate pure scheduling rules from HTTP handling and database access. UI validation helps the user; the server decides whether a write is valid.
- A session owns time, tutor, and room; bookings represent individual students. A pair is one session with two distinct students, not two conflicting sessions.
- `booked` and `no_show` consume resources; `cancelled` does not. Count active student bookings, not sessions, against the daily tutor limit of six.
- Preserve historical violations and show warnings. New scheduling writes must validate the affected session; cancellation remains possible on invalid historical data.
- Use one transaction path for all schedule writes, with the same transaction-scoped advisory lock, current-state validation, version checks, and atomic audit records.
- Use the fixed demo clock and timezone from `DESIGN.md` (visual design) and `TECHNICAL_DESIGN.md` (business/technical design). Never let the viewed date change the clock.
- No catalog CRUD, recurring schedules, drag-and-drop, billing implementation, WhatsApp sending, login, Realtime, attendance workflow, or extra administration tabs.

## Database and secrets

- Use a dedicated assignment database/project only. No existing product database may be reused.
- Database provisioning and migration execution require Bao's authorization; writing a migration file is not evidence that it was applied.
- Keep the connection string server-only in ignored `.env.local`; provide placeholders in `.env.example`. Never print or commit secrets.
- Plan a private application schema that is not exposed through the Supabase Data API. Verify its actual exposure and privileges during setup.
- Integration tests use a separate test database/schema, never the demo seed schema.
- Never repair source violations by deleting records or adding a global overlap constraint that makes the required import fail.

## Execution and verification

- Inspect canonical cwd, branch, working-tree state, and applicable instructions before editing. Preserve unrelated work.
- Do not delete any existing component, file, code block, or business logic without Bao's explicit approval for that deletion.
- Do not build or start a dev/production server unless explicitly requested in the current conversation.
- Before each heavyweight dependency, test, lint, typecheck, or build command, inspect `/Users/bao/.codex/bin/heavy-node-status`, then run the command through `/Users/bao/.codex/bin/heavy-node -- <command> [args...]`.
- Run heavyweight commands sequentially across agents; use one Vitest worker. Never remove the global lock manually or interrupt a slow command merely because it is silent.
- After an interrupted command, inspect PID and cwd before cleanup. Do not retry while its verified process tree remains alive.
- If a server is later authorized, identify it by absolute worktree path. Never kill an unknown listener or reuse another worktree's server. Prefer a free port, verify an HTTP response, and report the exact URL. For an authorized replacement build, capture source state before/after; if it changed, rebuild once before serving.
- Separate claims about source review, unit tests, database integration tests, browser behavior, builds, commits, pushes, and deployment. Report unverified layers plainly.
- No Git commit, push, submission, destructive database operation, or server shutdown without applicable user authorization. When commits are authorized, use small functional commits with what/why messages and preserve history; do not squash.

## Optional implementation delegation

After implementation is authorized, the supplied implementation brief permits UI, domain/test, and read-only reviewer agents. Delegate only bounded work after shared contracts exist. Do not launch agents during this documentation-only stage.

| Owner | Files and responsibilities |
| --- | --- |
| Coordinator | Scaffold, package files, shared contracts, schema/seed, API/transactions, integration, documentation, all heavyweight commands and authorized Git operations |
| UI agent | Assigned components using agreed contracts; fixtures are temporary and explicitly labeled |
| Domain/test agent | Pure validation helpers and assigned unit tests |
| Reviewer | Read-only review after integration; report severity and evidence limitations |

Subagents must not modify contracts, dependencies, migrations, or Git history. Use inherited model settings; the original brief requested Astra with medium reasoning. Do not silently change model settings.

## Communication and handoff

Explain why significant architecture or behavior choices are needed. Before acceptance, make the create and cancellation flows understandable from user action through API, transaction, database, and rendered result, including their main failure cases. Record real AI contributions and an actual rejected suggestion; do not fabricate reflection evidence.

The assessment allows 150 minutes total, including reading and planning. Track actual time and reduce scope rather than inventing a fresh time budget. Keep personal machine/workflow preferences outside shared repository policy unless explicitly requested.
