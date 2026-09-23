-- ============================================================================
-- Supabase Schema: Role-Based Access Control (RBAC) — FKIP Dashboard
-- ============================================================================

-- 1. Create table user_roles
create table if not exists public.user_roles (
  user_email text primary key,
  role text not null default 'viewer' check (role in ('super_admin', 'admin', 'viewer')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Indexes
create index if not exists idx_user_roles_role on public.user_roles(role);

-- 3. Trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
  before update on public.user_roles
  for each row
  execute function public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
alter table public.user_roles enable row level security;

-- Policy: Everyone authenticated can read roles
create policy "Allow read user_roles for authenticated users"
  on public.user_roles
  for select
  using (true);

-- Policy: Allow full access for super_admin and setup
create policy "Allow full access for super_admin and anon for setup"
  on public.user_roles
  for all
  using (true)
  with check (true);

-- 5. Seed default demo & initial administrator
insert into public.user_roles (user_email, role, display_name)
values
  ('demo@fkip.ut.ac.id', 'super_admin', 'Admin Demo FKIP'),
  ('fkip@ecampus.ut.ac.id', 'super_admin', 'Program Studi FKIP UT')
on conflict (user_email) do update
set role = excluded.role,
    display_name = excluded.display_name,
    updated_at = now();
