# Bright Path: decisions

## What I'd build

Basically, a sheet-like website for scheduling, with booking checks built in. Mai can add, edit and cancel lessons without checking every conflict by hand.

Features I considered:

- Schedule board with conflict checks and history — my pick.
- Login and user roles.
- Student and tutor management.
- Payment tracking and tutor pay.
- Repeating weekly lessons.

The board comes first because it covers Mai's daily work and keeps the scope small for the time limit. Payments and messages need more setup, so they stay manual for now.

## Questions I'd ask

- **Are pairs official? More than two students?** I support two for now. Larger groups need different capacity rules.
- **Six bookings means students or sessions?** I count students; a pair counts twice. I'd change the count if the owner means sessions.
- **Exact opening hours?** I assumed 09:00–22:00. Easy to update once confirmed.
- **Can some Mondays be open?** The brief says closed, but L032 was moved to Monday. I allow Monday lessons, with a popup asking reception to confirm again before saving. The exception is recorded in history; conflict checks and tutor limits still apply.

## Rules that needed a closer look

- The brief says one-to-one, but L009/L010 are an intentional pair. That's one session with two bookings.
- I kept all 34 bookings, including old conflicts. The app warns about them and checks new changes.
- Cancellation frees a place; no-show doesn't. A pair keeps its tutor and room until the last active booking is cancelled.
- Demo time stays at **3 March 2026, 17:00, UTC+7**. The first view is March 4 to show the pair and conflict. Today returns to March 3.

## Data and saving

- **Session:** time, tutor, room and version.
- **Booking:** one student, status and cancellation details.
- **History:** before/after values, reason and time.

Replacing a student cancels their old booking and creates a new one. Their old history stays intact.

Changes from 16:00 the previous day get an “After cutoff” label. Moves check both dates and appear in both days' history. Cancellation keeps the booking, reason and before/after history, even after cutoff. This doesn't mean the tutor saw an update.

- **Database checks:** required fields, references, statuses, duration and duplicates. These protect the basic records.
- **Server checks:** overlaps, opening times, tutor load and pair size. Keeping these here lets old violations remain readable.

A lock handles writes one at a time. The server checks the latest version, saves the change and history together, then the UI reloads. Failed checks save nothing. Cancellation still works on old conflicts.

## API

- `GET /api/schedule?date=...` — day schedule and history.
- `GET /api/schedule/month?date=...` — month overview.
- `POST /api/sessions` — create.
- `PATCH /api/sessions/:id` — edit, with version and reason.
- `POST /api/bookings/:id/cancel` — cancel, with version and reason.

I left out “save the whole sheet”. An old copy could overwrite someone else's changes.

## What's next

This is a public demo without login. Messages and billing are missing, and the shared write lock could become slow with more users.

With another week, I'd add:

1. Login and user roles.
2. Student, parent and tutor details.
3. Payment tracking: paid/unpaid, cash or bank transfer.
4. A payment gateway if time allows, after confirming fee rules.

## AI

AI helped with planning, code, tests and review. I set the sheet-style direction and chose Supabase/Vercel.

AI suggested tutor notifications next. I chose login, user management and payment tracking first. Before using real data, the centre needs to control who can change it. Tutor updates can stay manual for now.

I don't have a verified total for planning and revisions, so I can't claim everything fit the 150-minute limit.
