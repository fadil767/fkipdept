---
name: excel-data-pipeline
description: Data ingestion, normalization, validation, and export pipeline for Microsoft Excel (XLSX) and CSV spreadsheets within the FKIP UT Dashboard. Use when editing importExport.js, designing Excel import/export templates, parsing academic spreadsheets, validating imported lecturer or course records, or styling spreadsheet outputs.
---

# Excel & CSV Data Pipeline — FKIP UT Dashboard

Panduan standar pemrosesan berkas spreadsheet (Excel/CSV), validasi integritas data, dan formatting ekspor laporan di lingkungan FKIP UT.

## 1. Standar Template Impor & Ekspor

Sistem mendukung impor dan ekspor spreadsheet untuk 3 entitas utama:
1. **Data Dosen (`importLecturers` / `exportLecturersToXLSX`)**:
   - Kolom Wajib: `ID Dosen` (NIP/ID Tutor), `Nama Lengkap`, `Gelar`, `Bidang Keahlian` (dipisahkan koma), `Slot Tersedia`, `Rating` (1.0–5.0), `Email`, `No Telepon`.
2. **Katalog Mata Kuliah (`importCourses` / `exportCoursesToXLSX`)**:
   - Kolom Wajib: `Kode MK`, `Nama Mata Kuliah`, `SKS`, `Semester`.
3. **Plotting Kelas Semester (`importPlotting` / `exportPlottingToXLSX`)**:
   - Kolom: `ID Dosen`, `Nama Dosen`, `Mata Kuliah Terplot` (kode MK dipisahkan koma), `Jumlah Kelas`, `Semester`.

---

## 2. Aturan Sanitasi & Pembersihan Data Masuk (*Input Hygiene*)

Saat mem-parsing berkas Excel atau CSV pengguna (`parseXLSX` / `parseCSV`), terapkan sanitasi ketat:

### Sanitasi Teks & String
- Hilangkan spasi ganda dan karakter spasi tersembunyi (*trailing/leading whitespace*, non-breaking space `\u00A0`):
  ```javascript
  const cleanStr = (val) => String(val || "").replace(/[\u00A0\s]+/g, " ").trim();
  ```
- Normalisasi kode mata kuliah menjadi huruf kapital tanpa spasi:
  ```javascript
  const cleanCode = (code) => cleanStr(code).toUpperCase().replace(/\s+/g, "");
  ```

### Pemisahan Daftar Keahlian (*Expertise Parsing*)
- Pisahkan string berbasis koma (`,`), titik koma (`;`), atau baris baru (`\n`), hilangkan elemen kosong dan duplikat:
  ```javascript
  const parseExpertise = (raw) => 
    [...new Set(String(raw || "").split(/[,;\n]+/).map(s => s.trim()).filter(Boolean))];
  ```

### Validasi Nilai Numerik
- Batasi rating dosen dalam rentang valid `1.0` hingga `5.0`. Nilai di luar rentang wajib di-*clamp*.
- Slot ketersediaan wajib berupa bilangan bulat non-negatif (`Math.max(0, Math.round(Number(val) || 0))`).

---

## 3. Desain Ekspor XLSX Berbasis Identitas UT

Pustaka generator XML Spreadsheet internal ([importExport.js](file:///c:/Users/Fadil/.gemini/antigravity-ide/scratch/dept.dashboard-main/src/lib/importExport.js)) wajib mematuhi standar desain resmi:

1. **Header Row**:
   - Latar belakang: UT Cobalt Blue (`#005baa`).
   - Warna font: Putih tebal (*Bold White*).
   - Tinggi baris: 28pt dengan *vertical alignment centered*.
2. **Data Rows & Zebra Striping**:
   - Baris genap: Latar belakang abu-abu kebiruan lembut (`#f0f7ff`).
   - Baris ganjil: Putih bersih (`#ffffff`).
   - Border: Garis abu-abu tipis (`#e2e8f0`).
3. **Format Alignment Kolom**:
   - Teks Umum (Nama, Gelar, Email): *Left aligned*.
   - Kode MK, NIP/ID, Nomor Telepon, Status: *Center aligned*.
   - SKS, Rating, Jumlah Kelas: *Right aligned*.

---

## 4. Alur Review Impor (*Diff & Confirmation Modal*)

Sebelum data Excel dimasukkan secara permanen ke dalam state atau database Supabase:
1. Tampilkan modal pratinjau (`ImportReviewModal`).
2. Tampilkan metrik ringkasan:
   - Jumlah baris valid vs baris tidak valid.
   - Jumlah data baru (*Insert*).
   - Jumlah data yang diperbarui (*Update/Merge*).
   - Jumlah data duplikat yang diabaikan.
3. Berikan opsi kepada pengguna: apakah ingin **mengganti seluruh data** (*overwrite*) atau **menggabungkan data** (*merge append*).
