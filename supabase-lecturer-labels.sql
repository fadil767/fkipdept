-- Optional lecturer labels for admin-only teaching performance notes.
-- Run this in Supabase SQL Editor before expecting ratings and warning
-- notes to persist in the database.

alter table public.lecturers
add column if not exists rating integer not null default 0
  check (rating >= 0 and rating <= 5),
add column if not exists warning_note text not null default '';
