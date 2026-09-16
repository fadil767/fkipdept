-- =============================================================================
-- DATABASE SETUP & REALTIME CONFIGURATION: PROGRAM STUDI FKIP UNIVERSITAS TERBUKA
-- =============================================================================
-- Script ini membuat tabel, RLS policies, views publik, mengaktifkan fitur Realtime,
-- dan mengisikan data awal (seed data) lengkap khusus Program Studi FKIP.
--
-- CARA PENGGUNAAN:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Pilih Project Anda -> Masuk ke menu "SQL Editor"
-- 3. Paste seluruh isi script ini lalu klik tombol "Run".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. STRUKTUR TABEL UTAMA
-- -----------------------------------------------------------------------------

create table if not exists public.lecturers (
  id text primary key,
  degree text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  expertise jsonb not null default '[]'::jsonb,
  plotted jsonb not null default '[]'::jsonb,
  available integer not null default 0,
  rating integer not null default 0 check (rating >= 0 and rating <= 5),
  warning_note text not null default ''
);

create table if not exists public.courses (
  code text primary key,
  title text not null default '',
  credits integer not null default 0
);

create table if not exists public.academic_terms (
  code text primary key,
  name text not null default '',
  ay text not null default '',
  semester text not null default '',
  active boolean not null default false
);

create table if not exists public.term_plottings (
  id text primary key,
  term_code text not null references public.academic_terms(code) on delete cascade,
  lecturer_id text not null references public.lecturers(id) on delete cascade,
  plotted jsonb not null default '[]'::jsonb,
  available integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (term_code, lecturer_id)
);

create table if not exists public.course_class_plans (
  term_code text primary key references public.academic_terms(code) on delete cascade,
  counts jsonb not null default '{}'::jsonb,
  assignments jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_submissions (
  id text primary key,
  degree text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  expertise jsonb not null default '[]'::jsonb,
  plotted jsonb not null default '[]'::jsonb,
  available integer not null default 0,
  warning_note text not null default '',
  status text not null default 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason text not null default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 2. AKTIFKAN REPLIKASI REALTIME SUPABASE (WEBSOCKET LIVE CHANGES)
-- -----------------------------------------------------------------------------

-- Memastikan tabel-tabel utama terdaftar di publikasi supabase_realtime
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.lecturers;
alter publication supabase_realtime add table public.term_plottings;
alter publication supabase_realtime add table public.courses;
alter publication supabase_realtime add table public.academic_terms;
alter publication supabase_realtime add table public.course_class_plans;
alter publication supabase_realtime add table public.tutor_submissions;

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) & HAK AKSES
-- -----------------------------------------------------------------------------

alter table public.lecturers enable row level security;
alter table public.courses enable row level security;
alter table public.academic_terms enable row level security;
alter table public.term_plottings enable row level security;
alter table public.course_class_plans enable row level security;
alter table public.tutor_submissions enable row level security;

-- Bersihkan policy lama jika ada
drop policy if exists "Allow read access to everyone" on public.lecturers;
drop policy if exists "Allow full access to authenticated users" on public.lecturers;
drop policy if exists "Allow read access to everyone" on public.courses;
drop policy if exists "Allow full access to authenticated users" on public.courses;
drop policy if exists "Allow read access to everyone" on public.academic_terms;
drop policy if exists "Allow full access to authenticated users" on public.academic_terms;
drop policy if exists "Allow read access to everyone" on public.term_plottings;
drop policy if exists "Allow full access to authenticated users" on public.term_plottings;
drop policy if exists "Allow read access to everyone" on public.course_class_plans;
drop policy if exists "Allow full access to authenticated users" on public.course_class_plans;
drop policy if exists "Allow public submissions insert" on public.tutor_submissions;
drop policy if exists "Allow full access to authenticated users on submissions" on public.tutor_submissions;

-- Policy untuk lecturers
create policy "Allow read access to everyone" on public.lecturers
  for select using (true);
create policy "Allow full access to authenticated users" on public.lecturers
  for all to authenticated using (true) with check (true);

-- Policy untuk courses
create policy "Allow read access to everyone" on public.courses
  for select using (true);
create policy "Allow full access to authenticated users" on public.courses
  for all to authenticated using (true) with check (true);

-- Policy untuk academic_terms
create policy "Allow read access to everyone" on public.academic_terms
  for select using (true);
create policy "Allow full access to authenticated users" on public.academic_terms
  for all to authenticated using (true) with check (true);

-- Policy untuk term_plottings
create policy "Allow read access to everyone" on public.term_plottings
  for select using (true);
create policy "Allow full access to authenticated users" on public.term_plottings
  for all to authenticated using (true) with check (true);

-- Policy untuk course_class_plans
create policy "Allow read access to everyone" on public.course_class_plans
  for select using (true);
create policy "Allow full access to authenticated users" on public.course_class_plans
  for all to authenticated using (true) with check (true);

-- Policy untuk tutor_submissions (publik bisa daftar, admin bisa lihat & kelola)
create policy "Allow public submissions insert" on public.tutor_submissions
  for insert with check (true);
create policy "Allow full access to authenticated users on submissions" on public.tutor_submissions
  for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 4. VIEWS PUBLIK UNTUK PENGUNJUNG
-- -----------------------------------------------------------------------------

create or replace view public.public_lecturer_profiles as
select id, degree, name, expertise, available
from public.lecturers;

create or replace view public.public_courses as
select code, title, credits
from public.courses;

create or replace view public.public_academic_terms as
select code, name, ay, semester, active
from public.academic_terms;

create or replace view public.public_term_plottings as
select id, term_code, lecturer_id, plotted, available
from public.term_plottings;

grant select on public.public_lecturer_profiles to anon, authenticated;
grant select on public.public_courses to anon, authenticated;
grant select on public.public_academic_terms to anon, authenticated;
grant select on public.public_term_plottings to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. DATA AWAL RESMI (SEED DATA) PROGRAM STUDI FKIP
-- -----------------------------------------------------------------------------

-- Semester Akademik FKIP
insert into public.academic_terms (code, name, ay, semester, active)
values
  ('DEMO-2026-1', '2026/2027 Ganjil - FKIP', '2026/2027', 'Ganjil', true),
  ('DEMO-2025-2', '2025/2026 Genap - FKIP', '2025/2026', 'Genap', false)
on conflict (code) do update
set name = excluded.name, ay = excluded.ay, semester = excluded.semester, active = excluded.active;

-- Mata Kuliah FKIP Universitas Terbuka
insert into public.courses (code, title, credits)
values
  ('MKDK4001', 'Pengantar Pendidikan', 3),
  ('MKDK4002', 'Perkembangan Peserta Didik', 2),
  ('MKDK4005', 'Profesi Keguruan', 2),
  ('PDGK4101', 'Keterampilan Berbahasa Indonesia', 3),
  ('PDGK4105', 'Strategi Pembelajaran di SD', 3),
  ('PDGK4108', 'Matematika', 4),
  ('PDGK4201', 'Pembelajaran PKn di SD', 3),
  ('PDGK4205', 'Pembelajaran Terpadu di SD', 2),
  ('PDGK4301', 'Evaluasi Pembelajaran di SD', 2),
  ('IDIK4008', 'Penelitian Tindakan Kelas', 2)
on conflict (code) do update
set title = excluded.title, credits = excluded.credits;

-- Dosen Program Studi FKIP (FKIP001 - FKIP008)
insert into public.lecturers (id, degree, name, email, phone, expertise, plotted, available, rating, warning_note)
values
  ('FKIP001', 'Dr.', 'Dr. Rina Sulistiyowati, M.Pd.', 'rina.sulistiyowati@ecampus.ut.ac.id', '0812-8899-7711', '["Strategi Pembelajaran di SD", "Evaluasi Pembelajaran"]'::jsonb, '["PDGK4105", "PDGK4301"]'::jsonb, 0, 5, 'Koordinator Mata Kuliah PDGK4105'),
  ('FKIP002', 'Prof. Dr.', 'Prof. Dr. Hendra Gunawan, M.Ed.', 'hendra.gunawan@ecampus.ut.ac.id', '0813-1122-3344', '["Kurikulum & Teknologi Pendidikan", "Profesi Keguruan"]'::jsonb, '["MKDK4001", "MKDK4005"]'::jsonb, 0, 5, 'Guru Besar Teknologi Pendidikan'),
  ('FKIP003', 'M.Pd.', 'Siti Nurhaliza, S.Pd., M.Pd.', 'siti.nurhaliza@ecampus.ut.ac.id', '0857-2233-4455', '["Perkembangan Peserta Didik", "Pembelajaran Terpadu di SD"]'::jsonb, '["MKDK4002", "PDGK4205"]'::jsonb, 1, 4, ''),
  ('FKIP004', 'Dr.', 'Dr. Ahmad Fauzi, M.Pd.', 'ahmad.fauzi@ecampus.ut.ac.id', '0821-3344-5566', '["Pembelajaran Matematika SD", "Evaluasi Pembelajaran"]'::jsonb, '["PDGK4108"]'::jsonb, 1, 4, ''),
  ('FKIP005', 'M.Pd.', 'Dewi Lestari, S.Pd., M.Pd.', 'dewi.lestari@ecampus.ut.ac.id', '0878-4455-6677', '["Pendidikan Bahasa dan Sastra Indonesia", "Strategi Pembelajaran di SD"]'::jsonb, '["PDGK4101"]'::jsonb, 2, 5, ''),
  ('FKIP006', 'M.Ed.', 'Budi Santoso, S.Pd., M.Ed.', 'budi.santoso@ecampus.ut.ac.id', '0819-5566-7788', '["Pembelajaran PKn di SD", "Profesi Keguruan"]'::jsonb, '["PDGK4201"]'::jsonb, 1, 3, 'Perlu konfirmasi jadwal tutorial tatap muka/web.'),
  ('FKIP007', 'Dr.', 'Dr. Eka Pratama, M.Pd.', 'eka.pratama@ecampus.ut.ac.id', '0812-6677-8899', '["Penelitian Tindakan Kelas (PTK)", "Evaluasi Pembelajaran"]'::jsonb, '["IDIK4008"]'::jsonb, 1, 5, 'Fasilitator Workshop PTK Nasional'),
  ('FKIP008', 'M.Pd.', 'Tri Wahyuni, S.Pd., M.Pd.', 'tri.wahyuni@ecampus.ut.ac.id', '0852-7788-9900', '["Strategi Pembelajaran di SD", "Pembelajaran Terpadu di SD"]'::jsonb, '["PDGK4205"]'::jsonb, 1, 4, '')
on conflict (id) do update
set degree = excluded.degree, name = excluded.name, email = excluded.email, phone = excluded.phone,
    expertise = excluded.expertise, plotted = excluded.plotted, available = excluded.available,
    rating = excluded.rating, warning_note = excluded.warning_note;

-- Plotting Dosen ke Semester Ganjil (DEMO-2026-1)
insert into public.term_plottings (id, term_code, lecturer_id, plotted, available)
values
  ('DEMO-2026-1::FKIP001', 'DEMO-2026-1', 'FKIP001', '["PDGK4105", "PDGK4301"]'::jsonb, 0),
  ('DEMO-2026-1::FKIP002', 'DEMO-2026-1', 'FKIP002', '["MKDK4001", "MKDK4005"]'::jsonb, 0),
  ('DEMO-2026-1::FKIP003', 'DEMO-2026-1', 'FKIP003', '["MKDK4002", "PDGK4205"]'::jsonb, 1),
  ('DEMO-2026-1::FKIP004', 'DEMO-2026-1', 'FKIP004', '["PDGK4108"]'::jsonb, 1),
  ('DEMO-2026-1::FKIP005', 'DEMO-2026-1', 'FKIP005', '["PDGK4101"]'::jsonb, 2),
  ('DEMO-2026-1::FKIP006', 'DEMO-2026-1', 'FKIP006', '["PDGK4201"]'::jsonb, 1),
  ('DEMO-2026-1::FKIP007', 'DEMO-2026-1', 'FKIP007', '["IDIK4008"]'::jsonb, 1),
  ('DEMO-2026-1::FKIP008', 'DEMO-2026-1', 'FKIP008', '["PDGK4205"]'::jsonb, 1)
on conflict (id) do update
set plotted = excluded.plotted, available = excluded.available;

-- Rencana Jumlah Kelas Mata Kuliah (Course Class Plans)
insert into public.course_class_plans (term_code, counts, assignments)
values
  ('DEMO-2026-1',
   '{"MKDK4001": 2, "MKDK4002": 2, "MKDK4005": 2, "PDGK4101": 2, "PDGK4105": 3, "PDGK4108": 2, "PDGK4201": 2, "PDGK4205": 2, "PDGK4301": 2, "IDIK4008": 2}'::jsonb,
   '{"MKDK4001": ["FKIP002"], "MKDK4002": ["FKIP003"], "MKDK4005": ["FKIP002"], "PDGK4101": ["FKIP005"], "PDGK4105": ["FKIP001"], "PDGK4108": ["FKIP004"], "PDGK4201": ["FKIP006"], "PDGK4205": ["FKIP003", "FKIP008"], "PDGK4301": ["FKIP001"], "IDIK4008": ["FKIP007"]}'::jsonb)
on conflict (term_code) do update
set counts = excluded.counts, assignments = excluded.assignments;

-- Pengajuan Kesediaan Tutor Menunggu Verifikasi (Initial Submissions)
insert into public.tutor_submissions (id, degree, name, email, phone, expertise, plotted, available, warning_note, status)
values
  ('FKIP009', 'M.Pd.', 'Dra. Rina Sulistiyowati, M.Pd.', 'rina.sulistiyowati@ecampus.ut.ac.id', '0812-8899-7711', '["Strategi Pembelajaran di SD", "Evaluasi Pembelajaran"]'::jsonb, '["PDGK4105", "PDGK4301"]'::jsonb, 2, 'Bersedia mengampu tutorial online (Tuweb) hari Sabtu.', 'pending'),
  ('FKIP010', 'M.Pd.', 'Fajar Nugraha, S.Pd., M.Pd.', 'fajar.nugraha@ecampus.ut.ac.id', '0813-4455-6677', '["Profesi Keguruan", "Penelitian Tindakan Kelas (PTK)"]'::jsonb, '["MKDK4005", "IDIK4008"]'::jsonb, 2, 'Instruktur Nasional & Guru Penggerak Bersertifikat.', 'pending')
on conflict (id) do update
set status = excluded.status;

-- Selesai
