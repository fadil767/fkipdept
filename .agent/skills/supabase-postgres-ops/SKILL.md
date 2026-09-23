---
name: supabase-postgres-ops
description: Best practices and guidelines for Supabase PostgreSQL database operations, migrations, RLS policies, table indexing, and realtime synchronization for FKIP UT Dashboard. Use when creating SQL migration scripts, writing PostgreSQL tables, managing database schemas, debugging Supabase queries, configuring Row Level Security (RLS), or handling realtime channels.
---

# Supabase & PostgreSQL Operations — FKIP UT Dashboard

Panduan standar arsitektur dan operasional basis data Supabase / PostgreSQL untuk Dashboard Program Studi FKIP Universitas Terbuka.

## 1. Arsitektur Tabel Utama

Sistem dashboard FKIP UT beroperasi di atas tabel-tabel relasional utama:
1. `fkip_dosen`: Data master dosen dan tutor (ID, Nama, Gelar, Email, Nomor Telepon, Bidang Keahlian, Rating, Catatan Evaluasi).
2. `fkip_plotting`: Alokasi penugasan kelas per semester (relasi `dosen_id`, `term_code`, `plotted` array kode mata kuliah, `available` slot).
3. `fkip_courses`: Katalog mata kuliah aktif (Kode MK, Nama MK, SKS, Semester kurikulum).
4. `fkip_terms`: Master semester akademik (Kode Semester misal `2026-1`, Nama Semester, Status Aktif).
5. `fkip_tutor_submissions`: Pengajuan kesediaan mengajar tutor baru (Status: `pending`, `approved`, `rejected`).
6. `fkip_audit_logs`: Jejak audit aktivitas pengguna (Siapa, Tindakan, Entitas, Rincian, Timestamp).
7. `fkip_user_roles`: Hak akses pengguna berbasis email (Superadmin, Admin, Viewer).

---

## 2. Aturan Penulisan Migrasi SQL (Idempotency)

Setiap skrip migrasi SQL (`.sql`) yang dibuat untuk Supabase **wajib bersifat idempotent** (dapat dieksekusi berkali-kali tanpa memicu error atau merusak data yang sudah ada):

### Prinsip Pembuatan Tabel
```sql
CREATE TABLE IF NOT EXISTS public.fkip_dosen (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    degree VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(50),
    expertise JSONB DEFAULT '[]'::jsonb,
    available INTEGER DEFAULT 4,
    rating NUMERIC(3, 1) DEFAULT 5.0,
    warning_note TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### Penambahan Kolom Baru secara Aman
```sql
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'fkip_dosen' 
          AND column_name = 'warning_note'
    ) THEN 
        ALTER TABLE public.fkip_dosen ADD COLUMN warning_note TEXT;
    END IF;
END $$;
```

---

## 3. Kebijakan Keamanan (Row Level Security / RLS)

Semua tabel wajib mengaktifkan RLS untuk mencegah akses data tanpa otorisasi:

```sql
-- Aktifkan RLS
ALTER TABLE public.fkip_dosen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkip_plotting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkip_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Pembacaan Publik / Viewer (Read-Only)
CREATE POLICY "Public Read Access" 
ON public.fkip_dosen 
FOR SELECT 
USING (true);

-- Policy 2: Modifikasi Hanya untuk Pengguna Terotentikasi / Admin
CREATE POLICY "Authenticated Admin Write Access" 
ON public.fkip_dosen 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

---

## 4. Strategi Pengindeksan (Performance & Indexing)

Tabel dengan volume pencarian atau pertumbuhan tinggi (seperti `fkip_audit_logs` dan `fkip_plotting`) wajib memiliki indeks majemuk (*composite index*):

```sql
-- Index untuk pencarian log berdasarkan waktu dan email
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON public.fkip_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email 
ON public.fkip_audit_logs (user_email);

-- Index untuk filter plotting berdasarkan semester dan dosen
CREATE INDEX IF NOT EXISTS idx_plotting_term_lecturer 
ON public.fkip_plotting (term_code, lecturer_id);
```

---

## 5. Konfigurasi Realtime WebSocket

Agar perubahan data pada satu tab browser langsung tersinkronisasi ke perangkat lain tanpa refresh:
1. Pastikan tabel didaftarkan ke publikasi `supabase_realtime`:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.fkip_dosen;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.fkip_plotting;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.fkip_tutor_submissions;
   ```
2. Tetapkan `REPLICA IDENTITY FULL` agar event UPDATE memuat data baris sebelum dan sesudah perubahan:
   ```sql
   ALTER TABLE public.fkip_dosen REPLICA IDENTITY FULL;
   ALTER TABLE public.fkip_plotting REPLICA IDENTITY FULL;
   ```
3. Di sisi klien, selalu sediakan fallback `BroadcastChannel` lokal untuk menyinkronkan antar-tab jika koneksi internet terputus (*offline-first*).
