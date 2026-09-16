do $$ begin
 if not exists(select from pg_roles where rolname='bright_path_app') then create role bright_path_app login; end if;
 if not exists(select from pg_roles where rolname='bright_path_test_runner') then create role bright_path_test_runner login; end if;
 if not exists(select from pg_roles where rolname='bright_path_owner') then create role bright_path_owner login; end if;
end $$;
grant bright_path_owner to postgres;

-- bright_path is replaced only with a validated identifier by the migration runner.
create schema if not exists bright_path;
revoke all on schema bright_path from public, anon, authenticated;
create table if not exists bright_path.students (id text primary key, name text not null);
create table if not exists bright_path.tutors (id text primary key, name text not null, subject text not null, phone text not null);
create table if not exists bright_path.rooms (id text primary key);
create table if not exists bright_path.sessions (
  id text primary key, starts_at timestamptz not null, ends_at timestamptz not null,
  tutor_id text not null references bright_path.tutors(id), room_id text not null references bright_path.rooms(id),
  mode text not null check (mode in ('one_to_one','pair')), version integer not null default 1 check(version>0),
  check (ends_at - starts_at in (interval '60 minutes', interval '90 minutes'))
);
create table if not exists bright_path.bookings (
  id text primary key, session_id text not null references bright_path.sessions(id),
  student_id text not null references bright_path.students(id),
  status text not null check(status in ('booked','cancelled','no_show')),
  cancelled_at timestamptz, reason text, source_lesson_id text unique, source_note text,
  unique(session_id,student_id), check ((status='cancelled')=(cancelled_at is not null))
);
create table if not exists bright_path.schedule_changes (
  id text primary key, session_id text not null references bright_path.sessions(id),
  booking_id text references bright_path.bookings(id),
  action text not null check(action in ('created','rescheduled','cancelled')),
  before_snapshot jsonb, after_snapshot jsonb not null, occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(), reason text, after_cutoff boolean not null
);
create index if not exists sessions_starts_at_idx on bright_path.sessions(starts_at);
create index if not exists sessions_tutor_idx on bright_path.sessions(tutor_id);
create index if not exists sessions_room_idx on bright_path.sessions(room_id);
create index if not exists bookings_student_idx on bright_path.bookings(student_id);
create index if not exists changes_session_idx on bright_path.schedule_changes(session_id);
create index if not exists changes_booking_idx on bright_path.schedule_changes(booking_id);
revoke all on all tables in schema bright_path from public, anon, authenticated;

alter schema bright_path owner to bright_path_owner;
grant usage on schema bright_path to bright_path_app;
grant select on all tables in schema bright_path to bright_path_app;
grant insert,update on bright_path.sessions,bright_path.bookings to bright_path_app;
grant insert on bright_path.schedule_changes to bright_path_app;
alter table bright_path.students owner to bright_path_owner;
alter table bright_path.students enable row level security;
create policy runtime_access on bright_path.students to bright_path_app using (true) with check (true);
alter table bright_path.tutors owner to bright_path_owner;
alter table bright_path.tutors enable row level security;
create policy runtime_access on bright_path.tutors to bright_path_app using (true) with check (true);
alter table bright_path.rooms owner to bright_path_owner;
alter table bright_path.rooms enable row level security;
create policy runtime_access on bright_path.rooms to bright_path_app using (true) with check (true);
alter table bright_path.sessions owner to bright_path_owner;
alter table bright_path.sessions enable row level security;
create policy runtime_access on bright_path.sessions to bright_path_app using (true) with check (true);
alter table bright_path.bookings owner to bright_path_owner;
alter table bright_path.bookings enable row level security;
create policy runtime_access on bright_path.bookings to bright_path_app using (true) with check (true);
alter table bright_path.schedule_changes owner to bright_path_owner;
alter table bright_path.schedule_changes enable row level security;
create policy runtime_access on bright_path.schedule_changes to bright_path_app using (true) with check (true);
-- bright_path_test is replaced only with a validated identifier by the migration runner.
create schema if not exists bright_path_test;
revoke all on schema bright_path_test from public, anon, authenticated;
create table if not exists bright_path_test.students (id text primary key, name text not null);
create table if not exists bright_path_test.tutors (id text primary key, name text not null, subject text not null, phone text not null);
create table if not exists bright_path_test.rooms (id text primary key);
create table if not exists bright_path_test.sessions (
  id text primary key, starts_at timestamptz not null, ends_at timestamptz not null,
  tutor_id text not null references bright_path_test.tutors(id), room_id text not null references bright_path_test.rooms(id),
  mode text not null check (mode in ('one_to_one','pair')), version integer not null default 1 check(version>0),
  check (ends_at - starts_at in (interval '60 minutes', interval '90 minutes'))
);
create table if not exists bright_path_test.bookings (
  id text primary key, session_id text not null references bright_path_test.sessions(id),
  student_id text not null references bright_path_test.students(id),
  status text not null check(status in ('booked','cancelled','no_show')),
  cancelled_at timestamptz, reason text, source_lesson_id text unique, source_note text,
  unique(session_id,student_id), check ((status='cancelled')=(cancelled_at is not null))
);
create table if not exists bright_path_test.schedule_changes (
  id text primary key, session_id text not null references bright_path_test.sessions(id),
  booking_id text references bright_path_test.bookings(id),
  action text not null check(action in ('created','rescheduled','cancelled')),
  before_snapshot jsonb, after_snapshot jsonb not null, occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(), reason text, after_cutoff boolean not null
);
create index if not exists sessions_starts_at_idx on bright_path_test.sessions(starts_at);
create index if not exists sessions_tutor_idx on bright_path_test.sessions(tutor_id);
create index if not exists sessions_room_idx on bright_path_test.sessions(room_id);
create index if not exists bookings_student_idx on bright_path_test.bookings(student_id);
create index if not exists changes_session_idx on bright_path_test.schedule_changes(session_id);
create index if not exists changes_booking_idx on bright_path_test.schedule_changes(booking_id);
revoke all on all tables in schema bright_path_test from public, anon, authenticated;

alter schema bright_path_test owner to bright_path_owner;
grant usage on schema bright_path_test to bright_path_test_runner;
grant select on all tables in schema bright_path_test to bright_path_test_runner;
grant insert,update on bright_path_test.sessions,bright_path_test.bookings to bright_path_test_runner;
grant insert on bright_path_test.schedule_changes to bright_path_test_runner;
alter table bright_path_test.students owner to bright_path_owner;
alter table bright_path_test.students enable row level security;
create policy runtime_access on bright_path_test.students to bright_path_test_runner using (true) with check (true);
alter table bright_path_test.tutors owner to bright_path_owner;
alter table bright_path_test.tutors enable row level security;
create policy runtime_access on bright_path_test.tutors to bright_path_test_runner using (true) with check (true);
alter table bright_path_test.rooms owner to bright_path_owner;
alter table bright_path_test.rooms enable row level security;
create policy runtime_access on bright_path_test.rooms to bright_path_test_runner using (true) with check (true);
alter table bright_path_test.sessions owner to bright_path_owner;
alter table bright_path_test.sessions enable row level security;
create policy runtime_access on bright_path_test.sessions to bright_path_test_runner using (true) with check (true);
alter table bright_path_test.bookings owner to bright_path_owner;
alter table bright_path_test.bookings enable row level security;
create policy runtime_access on bright_path_test.bookings to bright_path_test_runner using (true) with check (true);
alter table bright_path_test.schedule_changes owner to bright_path_owner;
alter table bright_path_test.schedule_changes enable row level security;
create policy runtime_access on bright_path_test.schedule_changes to bright_path_test_runner using (true) with check (true);
grant insert on bright_path_test.students,bright_path_test.tutors,bright_path_test.rooms to bright_path_test_runner;
