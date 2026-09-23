---
name: ut-academic-pdf-engine
description: Guidelines, standards, and layout templates for generating official Universitas Terbuka academic documents (Surat Tugas Dosen, Rekapitulasi Plotting Kelas, Berita Acara) in PDF format. Use when creating, styling, fixing, or modifying PDF exports in the FKIP Dashboard.
---

# UT Academic PDF Engine — Standar Dokumen Resmi

Panduan standar pembuatan dan tata letak dokumen PDF resmi Universitas Terbuka (Fakultas Keguruan dan Ilmu Pendidikan).

## 1. Identitas Visual Dokumen Resmi UT

Dokumen resmi penugasan akademik (Surat Tugas Dosen & Rekapitulasi Plotting) wajib mematuhi panduan tata letak berikut:

### Kop Surat Resmi
- **Header Organisasi**:
  - Baris 1: KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI
  - Baris 2: UNIVERSITAS TERBUKA
  - Baris 3: FAKULTAS KEGURUAN DAN ILMU PENDIDIKAN (FKIP)
  - Baris 4: Jalan Cabe Raya, Pondok Cabe, Pamulang, Tangerang Selatan 15418
  - Baris 5: Telepon: 021-7490941, Laman: www.ut.ac.id
- **Garis Pembatas Kop**:
  - Dua garis sejajar horizontal selebar margin cetak: garis atas tebal (1.5pt - 2pt) dan garis bawah tipis (0.5pt).
- **Warna Identitas Utama**:
  - UT Cobalt Blue: `#005baa` (untuk header tabel, judul dokumen, atau aksen nomor surat).
  - Teks Badan: `#111827` (Hitam pekat untuk dokumen legal).

---

## 2. Struktur Anatomi Surat Tugas Dosen

Setiap Surat Tugas Penugasan Dosen Tutorial memuat bagian-bagian terstruktur:
1. **Nomor & Judul Surat**:
   - `SURAT TUGAS PENUGASAN TUTOR / DOSEN PENGAMPU`
   - Nomor: `B/XXX/UN31.FKIP/KM.01.02/2026`
2. **Konsiderans / Dasar Penugasan**:
   - Berdasarkan kebutuhan pelaksanaan proses belajar mengajar Program Studi FKIP Universitas Terbuka Semester [Semester Code].
3. **Identitas Dosen Pengampu**:
   - Nama Lengkap & Gelar Akademik.
   - NIP / ID Tutor.
   - Bidang Keahlian Pokok.
4. **Tabel Rincian Penugasan Mata Kuliah**:
   - Kolom: Nomor, Kode Mata Kuliah, Nama Mata Kuliah, Bobot SKS, Kelas Tutorial, Jadwal / Moda (Tuweb / Tuton).
5. **Klausul Kewajiban Akademik**:
   - Melaksanakan tutorial sebanyak 8 sesi pertemuan.
   - Memberikan dan mengoreksi 3 tugas tutorial wajib (Tugas 1, 2, dan 3).
   - Mengunggah nilai akhir tutorial tepat waktu sesuai kalender akademik UT.
6. **Blok Tanda Tangan Resmi**:
   - Tempat & Tanggal Penerbitan (contoh: Tangerang Selatan, [Tanggal]).
   - Dekan / Ketua Program Studi FKIP.
   - Ruang tanda tangan digital / basah dan NIP pejabat bersangkutan.

---

## 3. Standar Rekapitulasi Plotting Semester (Landscape / Multi-Page)

Untuk dokumen rekapitulasi seluruh dosen dalam satu semester:
- **Format Kertas**: A4 Landscape.
- **Margin**: Top 15mm, Bottom 15mm, Left 15mm, Right 15mm.
- **Header Kolom Tabel**:
  - Background: `#005baa` dengan teks putih tebal.
  - Kolom: No, ID Dosen, Nama Dosen & Gelar, Bidang Keahlian, Kelas Terplot, Total SKS, Status Kuota.
- **Zebra Striping**: Baris genap menggunakan warna latar `#f8fafc`.
- **Page Numbering**: Wajib di pojok kanan bawah dengan format: `Halaman X dari Y`.
- **Aturan Pemisahan Halaman (Page Split)**:
  - Baris tabel tidak boleh terbelah (*no split row*). Jika baris tidak muat di sisa halaman bawah, pindahkan seluruh baris ke halaman berikutnya (*auto page break*).

---

## 4. Best Practices Implementasi Teknis (jsPDF / Canvas)

1. **Ukuran Satuan**: Gunakan satuan milimeter (`mm`) atau poin (`pt`) untuk penentuan posisi koordinat yang presisi.
2. **Karakter Non-ASCII**: Selalu sanitasi teks dari karakter yang tidak didukung font default Helvetica (seperti tanda kutip lengkung `”`, dash panjang `—`, atau simbol aksen).
3. **Penyimpanan / Download**: Beri nama berkas yang informatif dan konsisten:
   - Surat Tugas: `Surat_Tugas_[ID_Dosen]_[Nama_Dosen]_[Semester].pdf`
   - Rekap Plotting: `Rekap_Plotting_FKIP_UT_[Semester]_[Tanggal].pdf`
