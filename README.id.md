# FORMA

**Sempurnakan sentuhan akhir tanpa mengubah desain asli.**

FORMA adalah ruang kerja *visual finishing* untuk desainer yang perlu menyiapkan, membersihkan, dan menyempurnakan aset visual mereka tanpa merusak atau mengubah esensi karya aslinya.

Awalnya dibangun khusus untuk alur kerja fotografi dan render desain interior, FORMA menangani pekerjaan repetitif yang biasa dilakukan setelah sesi photoshoot atau render: membersihkan metadata sensitif, membubuhkan watermark klien, mengubah ukuran gambar (*resize*), melakukan penyesuaian visual ringan, serta mengekspor seluruh aset dalam format batch secara efisien.

---

## Fitur Utama FORMA

* **Pembersihan Metadata (Metadata Cleanup)**  
  Menghapus data EXIF, koordinat GPS, informasi model kamera, dan metadata teknis lainnya sebelum file dibagikan ke publik, dengan tetap menjaga akurasi profil warna sRGB.

* **Studio Watermark (Watermark Studio)**  
  Membubuhkan logo watermark dengan pengaturan posisi 9 titik jangkar (*grid anchor*), skala ukuran, transparansi (*opacity*), dan sudut rotasi.

* **Preset Klien (Client Presets)**  
  Menyimpan konfigurasi watermark yang dapat digunakan kembali untuk berbagai proyek dan klien yang berbeda.

* **Resize & Kompresi Foto (Resize & Compression)**  
  Menyiapkan dimensi foto untuk media sosial (Instagram Feed 4:5, Square 1:1, Story 9:16, Web Banner) dengan kontrol framing yang presisi (*Cover* / *Contain*) tanpa distorsi *stretch*.

* **Penyesuaian Warna Non-Destruktif (Non-Destructive Adjustments)**  
  Mengatur nuansa kehangatan (*warmth*), kecerahan (*brightness*), kontras, dan saturasi langsung ke file output tanpa merusak file foto asli.

* **Pemrosesan Batch (Batch Processing)**  
  Memproses banyak foto sekaligus dengan manajemen memori browser yang aman dan terkontrol pada perangkat RAM kecil maupun besar.

* **Ruang Kerja Ekspor (Export Workspace)**  
  Mengunduh hasil foto secara individual maupun sekaligus dalam satu arsip file ZIP.

* **Pemrosesan Berbasis Perangkat (Local-First Processing)**  
  Seluruh pemrosesan inti gambar berjalan langsung di dalam browser pengguna (*client-side*).

---

## Filosofi

FORMA **bukan** dirancang untuk mendesain ulang (*redesign*) karya kreatif.

Komposisi asli, geometri ruang, material, dan keputusan desain arsitektur tetap menjadi sumber kebenaran utama (*source of truth*). FORMA hadir sebagai lapisan penyelesaian akhir antara karya yang sudah selesai dengan file yang siap dikirimkan ke klien, dipublikasikan ke media sosial, atau diarsipkan.

> **Sempurnakan sentuhan akhirnya. Jaga keaslian bentuknya.**

---

## Cakupan Saat Ini (Scope v1)

FORMA v1 berfokus pada *visual finishing* deterministik yang ringan dan cepat:

* Pembersihan metadata (EXIF/GPS)
* Pembubuhan watermark berbasis preset
* Resize dan kompresi rasio media sosial
* Penyesuaian warna dasar non-destruktif
* Antrean pemrosesan batch lokal
* Preset klien yang dapat disimpan
* Ekspor batch dalam format ZIP
* Riwayat pengiriman dan pemulihan tong sampah sementara (24 jam)

*Penyempurnaan berbasis AI (AI upscale / AI artifact correction) sengaja ditunda di luar cakupan v1 agar aplikasi tetap ringan, andal, dan 100% berjalan di perangkat.*

---

## Privasi & Keamanan Data

FORMA mengusung prinsip **local-first processing**.

Operasi pengolahan gambar dijalankan di dalam browser perangkat pengguna, sehingga meminimalkan kebutuhan untuk mengunggah file proyek beresolusi tinggi ke server pemrosesan pihak ketiga.

---

## Teknologi

FORMA dibangun menggunakan:

* **Next.js** (App Router, Static Export)
* **Browser Canvas & ImageBitmap APIs**
* **JSZip**
* **Cloudflare D1** (Sinkronisasi & database persisten)
* **Tailwind CSS & Heroicons**

---

## Status Proyek

**v1 MVP — Fitur Lengkap (*Feature Complete*)**

Implementasi saat ini telah lolos verifikasi otomatis:

* Type checking (`pnpm typecheck` — 0 error)
* Automated unit tests (`pnpm test` — 27/27 test passing)
* Production build verification (`pnpm build`)

*Pengujian penerimaan (*acceptance testing*) pada berbagai variasi browser dan perangkat fisik tetap dianjurkan sebelum menggunakan FORMA untuk alur kerja produksi kritis.*

---

## Lisensi

[MIT License](./LICENSE)
