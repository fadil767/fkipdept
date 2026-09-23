-- =============================================================================
-- SCRIPT PEMBERSIHAN DATA JUNK & RE-SYNC RESMI FKIP UNIVERSITAS TERBUKA
-- =============================================================================
-- Script ini membersihkan data uji coba / dummy yang tidak sesuai dengan
-- Program Studi FKIP (seperti '0200...', 'Dra. Jokowi', 'DR SULAIMAN', dll),
-- serta merapikan plotting kelas mata kuliah FKIP.
--
-- CARA PENGGUNAAN:
-- 1. Buka Supabase Console (https://supabase.com/dashboard)
-- 2. Pilih Project Anda -> Masuk ke menu "SQL Editor"
-- 3. Paste seluruh isi script ini lalu klik "Run".
-- =============================================================================

-- 1. Hapus plotting yang berelasi dengan ID dosen tidak sesuai/dummy
DELETE FROM public.term_plottings 
WHERE lecturer_id IN (
  '0200056123',
  '020005090',
  '02000598',
  '0200078492',
  '0200894823',
  '02000894',
  'FKIP626',
  'FKIP266',
  'FKIP009',
  'DOS-FKIP-004'
) OR lecturer_id LIKE '0200%';

-- 2. Hapus data dosen dummy / junk dari tabel lecturers
DELETE FROM public.lecturers 
WHERE id IN (
  '0200056123',
  '020005090',
  '02000598',
  '0200078492',
  '0200894823',
  '02000894',
  'FKIP626',
  'FKIP266',
  'FKIP009',
  'DOS-FKIP-004'
) OR id LIKE '0200%'
  OR lower(name) LIKE '%jokowi%'
  OR lower(name) LIKE '%sihabuddin%'
  OR lower(name) LIKE '%yahya fadillah%'
  OR lower(name) LIKE '%sulaiman%'
  OR lower(name) LIKE '%wafiddin%'
  OR lower(name) LIKE '%raihan%'
  OR lower(name) = 'rina';

-- 3. Pastikan 8 Dosen Inti FKIP Universitas Terbuka terdaftar dengan benar
INSERT INTO public.lecturers (id, degree, name, email, phone, expertise, plotted, available, rating, warning_note)
VALUES
  ('FKIP001', 'Dr.', 'Dr. Rina Sulistiyowati, M.Pd.', 'rina.sulistiyowati@ecampus.ut.ac.id', '0812-8899-7711', '["Strategi Pembelajaran di SD", "Evaluasi Pembelajaran"]'::jsonb, '["PDGK4105", "PDGK4301"]'::jsonb, 0, 5, 'Koordinator Mata Kuliah PDGK4105'),
  ('FKIP002', 'Prof. Dr.', 'Prof. Dr. Hendra Gunawan, M.Ed.', 'hendra.gunawan@ecampus.ut.ac.id', '0813-1122-3344', '["Kurikulum & Teknologi Pendidikan", "Profesi Keguruan"]'::jsonb, '["MKDK4001", "MKDK4005"]'::jsonb, 0, 5, 'Guru Besar Teknologi Pendidikan'),
  ('FKIP003', 'M.Pd.', 'Siti Nurhaliza, S.Pd., M.Pd.', 'siti.nurhaliza@ecampus.ut.ac.id', '0857-2233-4455', '["Perkembangan Peserta Didik", "Pembelajaran Terpadu di SD"]'::jsonb, '["MKDK4002", "PDGK4205"]'::jsonb, 1, 4, ''),
  ('FKIP004', 'Dr.', 'Dr. Ahmad Fauzi, M.Pd.', 'ahmad.fauzi@ecampus.ut.ac.id', '0821-3344-5566', '["Pembelajaran Matematika SD", "Evaluasi Pembelajaran"]'::jsonb, '["PDGK4108"]'::jsonb, 1, 4, ''),
  ('FKIP005', 'M.Pd.', 'Dewi Lestari, S.Pd., M.Pd.', 'dewi.lestari@ecampus.ut.ac.id', '0878-4455-6677', '["Pendidikan Bahasa dan Sastra Indonesia", "Strategi Pembelajaran di SD"]'::jsonb, '["PDGK4101"]'::jsonb, 2, 5, ''),
  ('FKIP006', 'M.Ed.', 'Budi Santoso, S.Pd., M.Ed.', 'budi.santoso@ecampus.ut.ac.id', '0819-5566-7788', '["Pembelajaran PKn di SD", "Profesi Keguruan"]'::jsonb, '["PDGK4201"]'::jsonb, 1, 3, 'Perlu konfirmasi jadwal tutorial tatap muka/web.'),
  ('FKIP007', 'Dr.', 'Dr. Eka Pratama, M.Pd.', 'eka.pratama@ecampus.ut.ac.id', '0812-6677-8899', '["Penelitian Tindakan Kelas (PTK)", "Evaluasi Pembelajaran"]'::jsonb, '["IDIK4008"]'::jsonb, 1, 5, 'Fasilitator Workshop PTK Nasional'),
  ('FKIP008', 'M.Pd.', 'Tri Wahyuni, S.Pd., M.Pd.', 'tri.wahyuni@ecampus.ut.ac.id', '0852-7788-9900', '["Strategi Pembelajaran di SD", "Pembelajaran Terpadu di SD"]'::jsonb, '["PDGK4205"]'::jsonb, 1, 4, '')
ON CONFLICT (id) DO UPDATE
SET degree = excluded.degree,
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    expertise = excluded.expertise,
    plotted = excluded.plotted,
    available = excluded.available,
    rating = excluded.rating,
    warning_note = excluded.warning_note;

-- 4. Rapikan Plotting Semester Ganjil 2026/2027 (DEMO-2026-1)
INSERT INTO public.term_plottings (id, term_code, lecturer_id, plotted, available)
VALUES
  ('DEMO-2026-1::FKIP001', 'DEMO-2026-1', 'FKIP001', '["PDGK4105", "PDGK4301"]'::jsonb, 0),
  ('DEMO-2026-1::FKIP002', 'DEMO-2026-1', 'FKIP002', '["MKDK4001", "MKDK4005"]'::jsonb, 0),
  ('DEMO-2026-1::FKIP003', 'DEMO-2026-1', 'FKIP003', '["MKDK4002", "PDGK4205"]'::jsonb, 1),
  ('DEMO-2026-1::FKIP004', 'DEMO-2026-1', 'FKIP004', '["PDGK4108"]'::jsonb, 1),
  ('DEMO-2026-1::FKIP005', 'DEMO-2026-1', 'FKIP005', '["PDGK4101"]'::jsonb, 2),
  ('DEMO-2026-1::FKIP006', 'DEMO-2026-1', 'FKIP006', '["PDGK4201"]'::jsonb, 1),
  ('DEMO-2026-1::FKIP007', 'DEMO-2026-1', 'FKIP007', '["IDIK4008"]'::jsonb, 1),
  ('DEMO-2026-1::FKIP008', 'DEMO-2026-1', 'FKIP008', '["PDGK4205"]'::jsonb, 1)
ON CONFLICT (id) DO UPDATE
SET plotted = excluded.plotted,
    available = excluded.available;

-- 5. Perbarui Rencana Kelas (Course Class Plans) Bersih FKIP
INSERT INTO public.course_class_plans (term_code, counts, assignments)
VALUES
  ('DEMO-2026-1',
   '{"MKDK4001": 2, "MKDK4002": 2, "MKDK4005": 2, "PDGK4101": 2, "PDGK4105": 3, "PDGK4108": 2, "PDGK4201": 2, "PDGK4205": 2, "PDGK4301": 2, "IDIK4008": 2}'::jsonb,
   '{"MKDK4001": ["FKIP002"], "MKDK4002": ["FKIP003"], "MKDK4005": ["FKIP002"], "PDGK4101": ["FKIP005"], "PDGK4105": ["FKIP001"], "PDGK4108": ["FKIP004"], "PDGK4201": ["FKIP006"], "PDGK4205": ["FKIP003", "FKIP008"], "PDGK4301": ["FKIP001"], "IDIK4008": ["FKIP007"]}'::jsonb)
ON CONFLICT (term_code) DO UPDATE
SET counts = excluded.counts,
    assignments = excluded.assignments,
    updated_at = now();

-- 6. Bersihkan Pengajuan Tutor Menunggu Verifikasi (Initial Submissions)
DELETE FROM public.tutor_submissions WHERE id IN ('FKIP009', 'FKIP010');
INSERT INTO public.tutor_submissions (id, degree, name, email, phone, expertise, plotted, available, warning_note, status)
VALUES
  ('FKIP009', 'Dr.', 'Dr. Ratna Dewi Sartika, M.Pd.', 'ratna.dewi@ecampus.ut.ac.id', '0812-7788-9900', '["Pendidikan Anak Usia Dini", "Perkembangan Peserta Didik"]'::jsonb, '["MKDK4002"]'::jsonb, 2, 'Bersedia mengampu tutorial online (Tuweb) hari Sabtu.', 'pending'),
  ('FKIP010', 'M.Pd.', 'Fajar Nugraha, S.Pd., M.Pd.', 'fajar.nugraha@ecampus.ut.ac.id', '0813-4455-6677', '["Profesi Keguruan", "Penelitian Tindakan Kelas (PTK)"]'::jsonb, '["MKDK4005", "IDIK4008"]'::jsonb, 2, 'Instruktur Nasional & Guru Penggerak Bersertifikat.', 'pending')
ON CONFLICT (id) DO UPDATE
SET degree = excluded.degree,
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    expertise = excluded.expertise,
    plotted = excluded.plotted,
    available = excluded.available,
    warning_note = excluded.warning_note,
    status = excluded.status;
