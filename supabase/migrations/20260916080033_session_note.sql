-- Separate reception notes from immutable source notes and audit reasons.
alter table bright_path.sessions add column if not exists note text not null default '';
alter table bright_path_test.sessions add column if not exists note text not null default '';
