---
name: audit-trail-and-security
description: Standards for enterprise audit logging, non-blocking batch flushing, role-based access control (RBAC), and sensitive academic data governance for FKIP UT. Use when implementing audit trails, modifying auditLog.js, checking RBAC permissions in rbac.js, masking sensitive lecturer PII, or reviewing application security.
---

# Audit Trail & Security Governance — FKIP UT Dashboard

Panduan standar audit logging, arsitektur *non-blocking batch flush*, kontrol akses berbasis peran (RBAC), dan tata kelola keamanan data akademik FKIP UT.

## 1. Taksonomi Event Audit Standar

Setiap aktivitas mutasi data dalam dashboard wajib dicatat melalui fungsi `logAction(userEmail, action, entityType, entityId, entityLabel, details)` di [auditLog.js](file:///c:/Users/Fadil/.gemini/antigravity-ide/scratch/dept.dashboard-main/src/lib/auditLog.js):

### Aksi yang Wajib Dicatat (`action`):
- `create`: Menambahkan dosen baru, membuat semester, atau menambah mata kuliah.
- `update`: Mengubah alokasi plotting, mengedit profil dosen, atau memperbarui rating.
- `delete`: Menghapus dosen atau menghapus plotting kelas.
- `bulk_delete`: Menghapus sejumlah dosen secara massal.
- `approve`: Menyetujui formulir pendaftaran kesediaan tutor baru.
- `reject`: Menolak pengajuan tutor.
- `autopilot`: Menjalankan algoritma otomatisasi penugasan kelas.
- `backup`: Mengunduh berkas cadangan sistem atau membuat snapshot.
- `restore`: Memulihkan basis data dari berkas arsip cadangan.
- `login` / `logout`: Sesi otentikasi pengguna.

### Tipe Entitas (`entity_type`):
- `lecturer`: Entitas data dosen/tutor.
- `plotting`: Entitas alokasi kelas per semester.
- `course`: Entitas katalog mata kuliah.
- `term`: Entitas semester akademik.
- `submission`: Entitas formulir pengajuan tutor.
- `system`: Operasi tingkat sistem (backup, restore, migrasi).

---

## 2. Arsitektur Non-Blocking Batch Flush

Agar pencatatan log tidak membebani performa interaksi UI dan tidak membuat panggilan jaringan berulang:
1. **In-Memory Queue**: Log baru dimasukkan ke antrean `pendingLogs` di memori klien.
2. **Debounced Timer**: Log ditahan selama interval batching (`BATCH_FLUSH_INTERVAL_MS = 2000`).
3. **Bulk Insertion**: Saat timer terpicu atau antrean mencapai batas, log dikirimkan sekaligus ke endpoint Supabase `fkip_audit_logs`.
4. **Local Fallback**: Jika jaringan terputus atau Supabase tidak terhubung, log disimpan ke `localStorage` (`ut_fkip_audit_logs`) dengan rotasi maksimal 500 entri terbaru.

---

## 3. Perlindungan Privasi Data Pribadi Dosen (PII Masking)

Informasi kontak dosen (Nomor Handphone/WhatsApp, Email Pribadi, NIK) harus dilindungi:
1. **Akses Viewer**:
   - Pengguna dengan role `viewer` (atau tampilan publik `PublicLookupScreen`) dilarang melihat nomor telepon lengkap dosen.
   - Masking format: `0812-****-5678` (hanya tampilkan 4 digit awal dan 4 digit akhir).
2. **Audit Log Details**:
   - Jangan pernah mencatat kata sandi, token otentikasi JWT, atau data sensitif mentah ke dalam kolom `details` pada audit log.

---

## 4. Matriks Otorisasi RBAC (*Role-Based Access Control*)

Sistem menerapkan 3 tingkatan hak akses pada [rbac.js](file:///c:/Users/Fadil/.gemini/antigravity-ide/scratch/dept.dashboard-main/src/lib/rbac.js):

| Tindakan / Fitur | SUPER_ADMIN | ADMIN | VIEWER |
| :--- | :---: | :---: | :---: |
| Lihat Dashboard & Direktori | ✅ | ✅ | ✅ (Read-Only) |
| Tambah / Edit / Hapus Dosen | ✅ | ✅ | ❌ |
| Jalankan AutoPilot / Rebalance | ✅ | ✅ | ❌ |
| Setujui / Tolak Pendaftar Tutor | ✅ | ✅ | ❌ |
| Backup & Restore Sistem | ✅ | ✅ | ❌ |
| Kelola Role Pengguna Lain | ✅ | ❌ | ❌ |
| Lihat Riwayat Audit Lengkap | ✅ | ✅ | ❌ |

Pengecekan hak akses di komponen wajib menggunakan helper semantik:
```javascript
if (can(userRole, 'edit_lecturers')) {
  // Tampilkan tombol edit / tindakan mutasi
}
```
