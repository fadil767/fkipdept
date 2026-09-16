create table if not exists public.term_plottings (
  id text primary key,
  term_code text not null references public.academic_terms(code) on delete cascade,
  lecturer_id text not null references public.lecturers(id) on delete cascade,
  plotted jsonb not null default '[]'::jsonb,
  available integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (term_code, lecturer_id)
);

alter table public.term_plottings enable row level security;

drop policy if exists "Authenticated users can read term plottings" on public.term_plottings;
create policy "Authenticated users can read term plottings"
on public.term_plottings
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert term plottings" on public.term_plottings;
create policy "Authenticated users can insert term plottings"
on public.term_plottings
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update term plottings" on public.term_plottings;
create policy "Authenticated users can update term plottings"
on public.term_plottings
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete term plottings" on public.term_plottings;
create policy "Authenticated users can delete term plottings"
on public.term_plottings
for delete
to authenticated
using (true);
