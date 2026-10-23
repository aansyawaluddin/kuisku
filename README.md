# KuisKu — Digitalisasi Quiz Pembelajaran

Web quiz **Next.js 16 + Supabase** dengan 3 asesmen dalam satu materi:

| Tahap | Asesmen | Tujuan |
|---|---|---|
| Awal materi | **Pre-test** | Mengetahui modal awal / kemampuan dasar |
| Tengah materi | **Kuis Formatif** | Memantau proses dan perbaikan |
| Akhir materi | **Post-test** | Mengukur hasil akhir / kelulusan |

Alur siswa per materi: **Pre-test → Materi Bagian 1 → Formatif → Materi Bagian 2 → Post-test** (bisa dibuat wajib berurutan).

## Fitur

**Umum**
- 3 role: **superadmin**, **mentor**, **siswa** — semua wajib login (email/username + password).
- **Scan QR/barcode untuk siswa**: login pakai kartu QR, gabung kelas lewat QR, buka asesmen langsung lewat QR.
- Responsif (siswa nyaman di HP, ada bottom-nav & tombol scan).

**Superadmin**
- Dashboard statistik + grafik aktivitas 14 hari.
- Kelola semua pengguna (buat, ubah, reset password, nonaktifkan, hapus), filter & cari.
- Akses semua kelas, materi, dan laporan.

**Mentor**
- Kelola kelas (kode kelas + QR gabung, ganti kode), tambah siswa (manual, pilih yang sudah ada, **import massal dari Excel**), keluarkan siswa.
- **Cetak kartu login QR** siswa, reset QR kartu yang hilang.
- Materi dengan konten Markdown + video YouTube (2 bagian), publikasi/draf.
- Setiap materi otomatis punya Pre-test, Formatif, Post-test.
- Bank soal pilihan ganda / benar-salah: gambar soal (upload), bobot, pembahasan, urutkan, **import format Aiken**, **salin soal Pre-test ↔ Post-test**.
- Pengaturan asesmen: durasi, KKM, jumlah percobaan (remedial), acak soal/opsi, tampilkan nilai/pembahasan, buka/tutup, jadwal.
- QR per asesmen untuk ditampilkan di kelas.
- Hasil: statistik, distribusi nilai, status tuntas, detail jawaban per siswa, reset percobaan, **analisis butir soal** (tingkat kesukaran + sebaran jawaban), **export CSV**.
- **Laporan N-Gain** (Hake) pre vs post per siswa + kategori & efektivitas, grafik, export CSV, cetak.

**Siswa**
- Beranda dengan progres tiap materi & “langkah berikutnya”.
- Mengerjakan: timer tersinkron server, **auto-save tiap jawaban**, tombol **ragu-ragu**, navigasi nomor soal, pintasan keyboard, **auto-submit saat waktu habis**, peringatan saat keluar tab.
- Hasil + pembahasan (jika diizinkan), remedial, riwayat semua asesmen, kartu login QR di profil.

**Keamanan**
- Kunci jawaban di tabel terpisah yang **tidak bisa dibaca siswa**; penilaian dilakukan di database (RPC `SECURITY DEFINER`).
- Row Level Security di semua tabel; role hanya bisa di-set lewat `app_metadata` (service role).
- Batas waktu, jumlah percobaan, dan urutan tahap ditegakkan di database, bukan hanya di UI.

## Setup

### 1. Supabase
1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** → tempel isi `supabase/schema.sql` → **Run**. (File aman dijalankan ulang.)
3. **Authentication → Sign In / Providers → Email**: matikan **“Allow new users to sign up”** (akun hanya dibuat oleh admin/mentor).
4. Catat dari **Project Settings → API**: Project URL, `anon` key, `service_role` key.

### 2. Aplikasi
```bash
cp .env.example .env.local     # isi 3 variabel Supabase
npm install
node --env-file=.env.local scripts/create-superadmin.mjs admin@sekolah.id PasswordKuat123 "Nama Admin"
npm run dev                    # http://localhost:3000
```
Login sebagai superadmin → buat akun mentor → mentor membuat kelas, siswa, materi, dan soal.

> **Kamera untuk scan QR hanya jalan di HTTPS** (atau `localhost`). Untuk uji di HP, deploy dulu atau pakai tunnel (mis. `cloudflared tunnel --url http://localhost:3000`).

### 3. Deploy ke Vercel
1. Push project ke GitHub (file `.env.local` otomatis tidak ikut).
2. Di [vercel.com](https://vercel.com) → **Add New → Project** → import repo. Framework terdeteksi otomatis (Next.js).
3. **Environment Variables** — isi 4 variabel (Production + Preview):
   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (rahasia) |
   | `STUDENT_EMAIL_DOMAIN` | mis. `siswa.kuisku.id` |
4. **Deploy**. Domain `*.vercel.app` sudah HTTPS, jadi scan QR pakai kamera langsung jalan.
5. Di Supabase → **Authentication → URL Configuration**: isi **Site URL** dengan domain Vercel Anda.

Catatan:
- `vercel.json` mengatur region fungsi ke **Singapura (`sin1`)**. Samakan dengan region project Supabase Anda (cek di Project Settings → General) agar halaman cepat; ganti nilainya jika Supabase Anda di region lain.
- Mengubah environment variable butuh **Redeploy** agar berlaku.
- QR kelas/asesmen memakai domain tempat halaman dibuka. Kalau nanti pakai custom domain, cetak ulang QR dari domain tersebut.

## Cara pakai singkat

**Login siswa**: username/NIS + password, atau tab **Scan Kartu Siswa** di halaman masuk.
Siswa tanpa email dibuatkan email internal `username@STUDENT_EMAIL_DOMAIN` (tidak perlu email asli).

**Import siswa** (di halaman kelas → Import), satu baris per siswa:
```
Andi Saputra, 22101
Bunga Lestari, 22102, rahasia123
```
Password default = username (ditambah `123` bila kurang dari 6 karakter).

**Import soal (format Aiken)** — pisahkan antar soal dengan baris kosong:
```
Organisme yang dapat membuat makanannya sendiri disebut...
A. Konsumen
B. Produsen
C. Dekomposer
ANSWER: B
PEMBAHASAN: Produsen berfotosintesis.
```

**N-Gain** = (Post − Pre) / (100 − Pre). Pre = nilai percobaan pertama pre-test, Post = nilai terbaik post-test.
Kategori: Tinggi ≥ 0,7 · Sedang 0,3–0,7 · Rendah < 0,3. Agar valid, pakai soal yang setara pada pre-test & post-test (fitur **Salin**).

## Struktur

```
supabase/schema.sql        # tabel, RLS, trigger, RPC penilaian, storage
scripts/create-superadmin.mjs
src/proxy.ts               # (Next 16: pengganti middleware) proteksi login
src/lib/                   # supabase clients, auth, actions, progres, laporan
src/components/            # UI kit, QR scanner/generator, editor soal, quiz runner
src/app/
  login/                   # login password + QR
  (app)/admin/...          # superadmin
  (app)/mentor/...         # kelas, materi, asesmen, hasil, N-Gain, kartu
  (app)/siswa/...          # beranda, materi, mulai kuis, hasil, riwayat, scan
  (focus)/kerjakan/[id]    # layar pengerjaan (tanpa sidebar)
  join/[code]              # tautan gabung kelas (dari QR)
  api/export/...           # export CSV
```
