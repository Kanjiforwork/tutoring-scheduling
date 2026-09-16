-- __SCHEMA__ is replaced only with a validated identifier by the migration runner.
create schema if not exists __SCHEMA__;
revoke all on schema __SCHEMA__ from public, anon, authenticated;
create table if not exists __SCHEMA__.students (id text primary key, name text not null);
create table if not exists __SCHEMA__.tutors (id text primary key, name text not null, subject text not null, phone text not null);
create table if not exists __SCHEMA__.rooms (id text primary key);
create table if not exists __SCHEMA__.sessions (
  id text primary key, starts_at timestamptz not null, ends_at timestamptz not null,
  tutor_id text not null references __SCHEMA__.tutors(id), room_id text not null references __SCHEMA__.rooms(id),
  mode text not null check (mode in ('one_to_one','pair')), version integer not null default 1 check(version>0),
  check (ends_at - starts_at in (interval '60 minutes', interval '90 minutes'))
);
create table if not exists __SCHEMA__.bookings (
  id text primary key, session_id text not null references __SCHEMA__.sessions(id),
  student_id text not null references __SCHEMA__.students(id),
  status text not null check(status in ('booked','cancelled','no_show')),
  cancelled_at timestamptz, reason text, source_lesson_id text unique, source_note text,
  unique(session_id,student_id), check ((status='cancelled')=(cancelled_at is not null))
);
create table if not exists __SCHEMA__.schedule_changes (
  id text primary key, session_id text not null references __SCHEMA__.sessions(id),
  booking_id text references __SCHEMA__.bookings(id),
  action text not null check(action in ('created','rescheduled','cancelled')),
  before_snapshot jsonb, after_snapshot jsonb not null, occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(), reason text, after_cutoff boolean not null
);
create index if not exists sessions_starts_at_idx on __SCHEMA__.sessions(starts_at);
create index if not exists sessions_tutor_idx on __SCHEMA__.sessions(tutor_id);
create index if not exists sessions_room_idx on __SCHEMA__.sessions(room_id);
create index if not exists bookings_student_idx on __SCHEMA__.bookings(student_id);
create index if not exists changes_session_idx on __SCHEMA__.schedule_changes(session_id);
create index if not exists changes_booking_idx on __SCHEMA__.schedule_changes(booking_id);
revoke all on all tables in schema __SCHEMA__ from public, anon, authenticated;

-- Reception notes are editable; source notes remain unchanged.
alter table __SCHEMA__.sessions add column if not exists note text not null default '';
