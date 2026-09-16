-- Public-safe read surface for Public Mode.
-- Run this in Supabase SQL Editor.
--
-- These views expose only the fields needed by the public tutor lookup.
-- Do not create anon SELECT policies on public.lecturers if email/phone
-- should remain private.

alter table public.lecturers enable row level security;
alter table public.courses enable row level security;
alter table public.academic_terms enable row level security;
alter table public.term_plottings enable row level security;

drop policy if exists "Public users can read lecturers" on public.lecturers;

drop view if exists public.public_lecturer_profiles;
create view public.public_lecturer_profiles as
select
  id,
  degree,
  name,
  expertise,
  '[]'::jsonb as plotted,
  0::integer as available
from public.lecturers;

drop view if exists public.public_courses;
create view public.public_courses as
select
  code,
  title,
  credits
from public.courses;

drop view if exists public.public_academic_terms;
create view public.public_academic_terms as
select
  code,
  name,
  ay,
  semester,
  active
from public.academic_terms;

drop view if exists public.public_term_plottings;
create view public.public_term_plottings as
select
  id,
  term_code,
  lecturer_id,
  plotted,
  available
from public.term_plottings;

grant select on public.public_lecturer_profiles to anon, authenticated;
grant select on public.public_courses to anon, authenticated;
grant select on public.public_academic_terms to anon, authenticated;
grant select on public.public_term_plottings to anon, authenticated;

