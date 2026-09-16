-- Durable, cross-device storage for per-term class counts and assignments.
-- Run this in the Supabase SQL Editor before expecting class plans to sync.

create table if not exists public.course_class_plans (
  term_code text primary key references public.academic_terms(code) on delete cascade,
  counts jsonb not null default '{}'::jsonb,
  assignments jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.course_class_plans enable row level security;

drop policy if exists "Authenticated users can read course class plans" on public.course_class_plans;
create policy "Authenticated users can read course class plans"
on public.course_class_plans
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert course class plans" on public.course_class_plans;
create policy "Authenticated users can insert course class plans"
on public.course_class_plans
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update course class plans" on public.course_class_plans;
create policy "Authenticated users can update course class plans"
on public.course_class_plans
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete course class plans" on public.course_class_plans;
create policy "Authenticated users can delete course class plans"
on public.course_class_plans
for delete
to authenticated
using (true);
