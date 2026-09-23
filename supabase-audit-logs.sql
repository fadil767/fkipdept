-- =============================================================================
-- AUDIT LOG TABLE — FKIP Dashboard
-- =============================================================================
-- Mencatat semua perubahan data yang dilakukan oleh admin.
-- Jalankan script ini di Supabase SQL Editor.
-- =============================================================================

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_email text not null default '',
  action text not null,           -- 'create', 'update', 'delete', 'approve', 'reject', 'import', 'login', 'logout'
  entity_type text not null,      -- 'lecturer', 'course', 'term', 'plotting', 'submission', 'auth'
  entity_id text not null default '',
  entity_label text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for efficient queries
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_user_email on public.audit_logs(user_email);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Authenticated users can INSERT (log actions)
create policy "Authenticated users can insert audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (true);

-- Authenticated users can SELECT (view logs)
create policy "Authenticated users can read audit logs"
  on public.audit_logs for select
  to authenticated
  using (true);

-- Enable Realtime (optional)
alter publication supabase_realtime add table public.audit_logs;
