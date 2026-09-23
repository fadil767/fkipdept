---
name: academic-plotting-autopilot
description: Rules, constraints, heuristics, and algorithmic business logic for academic lecturer class plotting and AutoPilot optimization in FKIP Universitas Terbuka. Use when adjusting autoPilot.js, configuring class assignment algorithms, balancing lecturer workloads, resolving plotting conflicts, or calculating plotting health metrics.
---

# Academic Plotting & AutoPilot — FKIP Universitas Terbuka

Panduan aturan bisnis akademik, algoritma alokasi kelas otomatis (AutoPilot), dan heuristik penyeimbangan beban mengajar dosen di lingkungan FKIP UT.

## 1. Aturan Bisnis Beban Mengajar Dosen

1. **Batas Maksimal Kelas per Semester (`LECTURER_CLASS_LIMIT`)**:
   - Dosen Reguler / Tutor Eksternal: Standar maksimal **4 kelas** per semester.
   - Dosen Teladan / Rating Tinggi (Rating ≥ 4.8): Diizinkan hingga maksimal **5 kelas**.
   - Dosen Evaluasi Rendah (Rating ≤ 3.5 atau memiliki catatan peringatan): Dibatasi maksimal **2 kelas** atau ditangguhkan dari penugasan tutorial online.
2. **Kesesuaian Bidang Keahlian (*Expertise Matching*)**:
   - Dosen hanya boleh dialokasikan pada mata kuliah yang memiliki irisan (*substring match* atau kata kunci sinonim) dengan `expertise` dosen bersangkutan.
   - Contoh: Dosen dengan keahlian `"Pendidikan Bahasa Indonesia"` diprioritaskan untuk kode `MKDK4001` (Bahasa Indonesia) atau `PDGK4109`.
3. **Batas Beban SKS**:
   - 1 kelas tutorial setara dengan 2 hingga 3 SKS beban kerja.
   - Total beban wajar dosen tutorial per semester berkisar antara **6 – 12 SKS**. Penugasan di atas 14 SKS memicu status peringatan *Overload*.

---

## 2. Metrik Kesehatan Plotting (*Plotting Health Score*)

Algoritma `calculatePlottingHealth(lecturers, termPlottings, courses)` mengevaluasi kualitas alokasi kelas dalam skala 0 – 100 berdasarkan 4 pilar:

| Pilar Evaluasi | Bobot | Kriteria Penilaian |
| :--- | :---: | :--- |
| **1. Rasio Keterisian Kelas** | 40% | Persentase kelas yang sudah memiliki pengampu dari seluruh kelas yang direncanakan. |
| **2. Kesesuaian Keahlian** | 30% | Persentase penugasan yang cocok 100% dengan bidang keahlian dosen. |
| **3. Pemerataan Beban Kerja** | 20% | Standar deviasi jumlah kelas antar-dosen (menghindari penumpukan beban di sebagian dosen). |
| **4. Kepatuhan Batas Kuota** | 10% | Tidak ada dosen yang melebihi batas kuota maksimal (nol pelanggaran overload). |

---

## 3. Heuristik Algoritma AutoPilot

Algoritma `buildAutoPilotPlotting` bekerja dalam fase berurutan:
1. **Fase 1: Filter Dosen Tersedia**:
   - Identifikasi seluruh dosen yang memiliki slot tersedia (`available > 0`) dan tidak memiliki status peringatan berat.
2. **Fase 2: Prioritas Mata Kuliah Berdasarkan Kebutuhan**:
   - Urutkan mata kuliah yang belum teralokasi, dahulukan mata kuliah dengan jumlah kelas terbanyak dan spesialisasi langka.
3. **Fase 3: Greedy Best-Fit Matching**:
   - Untuk setiap kelas kosong, cari kandidat dosen dengan skor kecocokan tertinggi:
     - Skor = (Kesesuaian Keahlian x 50) + (Rating Kinerja x 10) + (Sisa Slot Tersedia x 5) - (Beban Saat Ini x 8).
4. **Fase 4: Penyeimbangan Beban (*Load Rebalancing*)**:
   - Jika ada dosen yang terplot 0 kelas padahal memiliki keahlian yang relevan, tukar satu slot dari dosen yang memiliki beban tertinggi.

---

## 4. Panduan Penanganan Konflik & Manual Override

1. **Aturan Pertukaran Slot (*Swap Assignment Slots*)**:
   - Saat admin menukar slot antar-dua dosen, sistem wajib memvalidasi apakah kedua dosen sama-sama memenuhi syarat keahlian mata kuliah yang ditukar.
2. **Penyimpanan State Snapshot**:
   - Setiap kali AutoPilot atau Rebalancing dijalankan, sistem wajib menyimpan cadangan status sebelumnya ke dalam `undoStack` sehingga admin dapat membatalkan perubahan secara instan jika hasil algoritma belum memuaskan.
