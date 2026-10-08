# fadTwibbon — Product Requirements Document (PRD)

**Project:** fadTwibbon  
**Repository:** https://github.com/fadd3079-prog/fadTwibbon  
**Document:** `PRD.md`  
**Version:** 1.0-draft  
**Date:** 2026-10-08  
**Status:** Draft for review, not an approved SRS baseline  
**Primary language:** Bahasa Indonesia  
**Product category:** Lightweight multi-tenant Twibbon campaign platform  
**Architecture:** Static frontend + browser-based image processing + Supabase backend  

> **Status keputusan:** Dokumen ini menggabungkan kebutuhan eksplisit pemilik produk dan rekomendasi desain. Ketentuan bertanda **[FINAL]** merupakan keputusan proyek yang telah disepakati dalam diskusi; **[USULAN]** harus dikonfirmasi sebelum implementasi dianggap final; **[VALIDASI]** memerlukan pengukuran, pengujian, atau klarifikasi stakeholder. Jangan menganggap target performa, kuota produk pihak ketiga, ataupun keberhasilan 500 pengguna simultan sebagai fakta yang sudah teruji.

---

## 1. Ringkasan Eksekutif

fadTwibbon adalah aplikasi web untuk membuat dan membagikan Twibbon dari template PNG yang diunggah oleh pemilik kampanye. Admin dapat mendaftar, masuk, membuat kampanye, mengunggah template, mengatur caption, memublikasikan tautan, dan melihat statistik kampanye miliknya. Super Admin adalah pemilik platform, yang memiliki kewenangan mengawasi seluruh akun, kampanye, aset, dan pemakaian sumber daya. Pengunjung tidak perlu login: cukup membuka tautan kampanye, memilih foto dari perangkat, menggeser/memperbesar/memperkecil/memutar foto, lalu mengunduh PNG komposit dan menyalin caption.

**Prinsip produk yang tidak boleh dikompromikan:**

1. **[FINAL] Mobile-first, sederhana, tanpa intro yang panjang.** Halaman publik berisi hanya judul kampanye, preview/editor, tombol pilih foto, kontrol edit, unduh, dan salin caption, dengan informasi kegagalan yang relevan.
2. **[FINAL] Privacy by design.** Foto peserta tidak pernah dikirim atau disimpan oleh server aplikasi; pemilihan, decoding, editing, komposit, dan ekspor berlangsung di browser perangkat peserta.
3. **[FINAL] Template adalah layer tetap.** Gestur pengguna hanya memengaruhi foto; template tidak bisa dipindahkan, diputar, diperbesar, dipotong, atau dipilih sebagai layer terpisah lewat editor.
4. **[FINAL] Ekspor mengikuti dimensi template asli**, lazimnya 1080 × 1080 piksel, bukan ukuran CSS preview.
5. **[FINAL] Platform multi-tenant.** Setiap Admin mengelola kampanye dan statistik sendiri; Super Admin memiliki pengawasan lintas tenant.
6. **[FINAL] GitHub → Vercel untuk frontend; Supabase Auth, PostgreSQL, dan Storage untuk layanan bersama.** Aplikasi tidak membutuhkan Laravel/VPS untuk MVP.
7. **[FINAL] Optimalkan untuk lonjakan sekitar 500 pengunjung dalam waktu berdekatan**, tetapi verifikasi kapasitas sebenarnya lewat pengujian dan metrik operasional.
8. **[FINAL] Prioritaskan kuota gratis**, sambil mencatat bahwa keberlangsungan produksi dan penggunaan komersial bergantung pada kebijakan penyedia hosting.
9. **[USULAN] Data kampanye publik disajikan lewat manifest JSON yang dapat di-cache**, sehingga halaman publik tidak harus meminta data PostgreSQL setiap kali dibuka.
10. **[USULAN] Statistik mencatat event aplikasi 'ekspor selesai/unduhan dimulai', bukan klaim file pasti tersimpan atau jumlah orang unik.**

fadTwibbon mengambil inspirasi alur editor Twibbonize, **bukan meniru merek, logo, aset, desain identik, source code proprietari, atau konten pihak lain**.

## 2. Latar Belakang, Masalah, dan Peluang

### 2.1 Problem statement (hipotesis untuk discovery)

Penyelenggara kampanye membutuhkan sarana sederhana untuk memublikasikan bingkai foto dan caption melalui tautan yang dapat dibagikan, sementara peserta membutuhkan pengalaman mengedit foto yang mudah pada perangkat seluler dan tidak mengharuskan unggah foto pribadi ke server. Pengelola platform juga perlu mengendalikan banyak akun dan kampanye tanpa penggunaan storage dan database berlebihan.

**Catatan:** pernyataan ini merupakan rumusan awal berdasarkan brief pemilik produk, **bukan** temuan observasi lapangan. Jangan membuat angka waktu yang 'dihemat', tingkat keluhan, atau hasil survei tanpa data nyata.

### 2.2 Stakeholder

| Stakeholder | Kebutuhan utama | Tanggung jawab |
| --- | --- | --- |
| Pengunjung/peserta | Editor cepat, aman untuk privasi, unduhan berhasil | Memilih foto dan mengoperasikan editor |
| Admin/pemilik kampanye | Pendaftaran, login, pembuatan kampanye, caption, template, statistik | Mengelola kampanye dan memastikan hak atas desain |
| Super Admin/pemilik website | Moderasi, kontrol akun, kuota, keamanan, gambaran platform | Kebijakan dan operasional platform |
| Pengembang/maintainer | Arsitektur sederhana, audit dan test mudah, deploy stabil | Implementasi dan pemeliharaan |
| Penyedia infrastruktur | Batas kuota dan layanan | Vercel, Supabase, GitHub |

### 2.3 Discovery yang harus dilakukan [VALIDASI]

- Observasi minimal satu skenario admin membuat/membagikan kampanye dan satu skenario peserta membuat Twibbon menggunakan HP.
- Uji prototipe dengan perangkat Android kelas menengah/bawah dan iPhone/Safari; catat kegagalan, bukan hanya happy path.
- Konfirmasi frekuensi kampanye per admin, ukuran PNG yang biasa dipakai, apakah rasio selain 1:1 diperlukan, serta volume unduh yang realistis.
- Konfirmasi apakah pendaftaran terbuka atau hanya admin yang disetujui Super Admin dapat memublikasikan konten.
- Pastikan kebijakan moderasi dan perizinan template, retensi statistik, serta kebutuhan fitur hapus akun.
- Pisahkan fakta observasi, asumsi, kebutuhan yang disetujui, dan saran implementasi. Setiap perubahan dicatat di revision log.

## 3. Tujuan, Hasil, dan Non-Goals

### 3.1 Tujuan produk

- Memungkinkan pengguna membuat Twibbon dari foto lokal tanpa mendaftar atau mengunggah foto.
- Memungkinkan admin membuat dan membagikan kampanye secara mandiri.
- Mengisolasi kepemilikan data antar admin lewat otorisasi server dan Row Level Security (RLS).
- Menyediakan statistik aktivitas kampanye yang cukup berguna tetapi ringan.
- Meminimalkan pemakaian storage, bandwidth, pemanggilan database, jumlah request backend, dan RAM perangkat.
- Menghasilkan antarmuka ringkas, aksesibel, cepat, dan intuitif pada perangkat seluler.

### 3.2 Indikator keberhasilan [USULAN; target harus divalidasi]

| Metrik | Pengukuran | Target awal / status |
| --- | --- | --- |
| Keberhasilan alur peserta | Sesi uji: masuk kampanye → pilih foto → edit → ekspor | Tidak ada defect penghalang pada perangkat uji; persentase ditetapkan setelah baseline |
| Kebocoran foto | Inspeksi Network, log server, Storage, database | **0 unggahan foto peserta** dari kode aplikasi |
| Transformasi foto | Visual regression pada move/scale/rotate | Template tetap identik secara geometri |
| Resolusi hasil | Ukuran pixel file yang diekspor | Sama dengan resolusi template yang dipublikasikan |
| Kontrol akses | Uji RLS, Storage policy, fungsi backend | Tidak ada akses tenant silang yang tidak sah |
| Kapasitas burst | Skenario 500 pengunjung berdekatan | Tidak ada kegagalan sistemik; p95 dan tingkat kesalahan diukur dalam staging |
| Konsumsi kuota | Supabase/Vercel dashboard | Ada pemantauan dan tindakan saat mendekati batas |

### 3.3 Di luar cakupan MVP

Tidak ada AI photo generation, penghapusan background otomatis, filter beauty, pengeditan template oleh peserta, galeri foto peserta, penyimpanan hasil edit di cloud, login peserta, sistem sosial/komentar, payment gateway, marketplace template, video Twibbon, rendering gambar di server, maupun aplikasi native Android/iOS. Jangan menambahkan fitur tanpa perubahan PRD.

## 4. Role dan Otorisasi

### 4.1 Role

1. **Guest/User:** tidak login, hanya membaca kampanye publik dan membuat Twibbon lokal.
2. **Admin:** akun terverifikasi yang dapat mengelola kampanye, template, caption, dan statistik miliknya.
3. **Super Admin:** akun khusus milik pemilik website yang dapat mengelola akun admin, melihat kampanye global, moderasi, kuota, dan statistik agregat.

### 4.2 Matriks izin

| Operasi | Guest | Admin | Super Admin |
| --- | --- | --- | --- |
| Lihat kampanye published | Ya | Ya | Ya |
| Edit foto lokal / ekspor / salin caption | Ya | Ya | Ya |
| Daftar akun biasa | Ya | — | Tidak melalui registrasi publik |
| Login/logout/reset password | — | Ya | Ya |
| Buat dan ubah kampanye | — | Hanya milik sendiri | Semua lewat layanan berwenang |
| Upload/ganti/hapus template | — | Hanya milik sendiri | Semua lewat layanan berwenang |
| Melihat statistik per kampanye | — | Hanya milik sendiri | Semua |
| Lihat semua akun admin | — | Tidak | Ya |
| Suspend akun/campaign | — | Tidak | Ya |
| Tetapkan role super_admin | — | Tidak | Hanya melalui provisioning terproteksi |

**Aturan keamanan:** role tidak boleh dipercaya dari localStorage, querystring, kolom profil yang dapat diedit, ataupun `user_metadata` yang dapat dimodifikasi sendiri. Role otoritatif harus disimpan pada mekanisme server-terproteksi (mis. claims yang dikelola server dan/atau tabel role dengan RLS restriktif). Jangan pernah menyediakan endpoint publik untuk promosi role. Akun Super Admin di-provision sekali secara manual oleh operator tepercaya; simpan prosedur recovery terpisah, tidak di repo publik.

### 4.3 Autentikasi

- Registrasi admin menggunakan email/password via Supabase Auth; konfirmasi email wajib sebelum akses admin.
- Login menggunakan sesi terkelola; logout membatalkan sesi sisi klien dan membersihkan state privat UI.
- Fitur lupa password/reset password dengan redirect yang allowlisted.
- Middleware/route guard untuk UI saja **bukan** kontrol keamanan utama; semua akses server dilindungi RLS/policy.
- Akun suspended tidak boleh membuat, mengubah, maupun mengunggah kampanye; sesi aktif harus diperiksa saat aksi terlindungi.
- [USULAN] Registrasi terbuka, tetapi publikasi kampanye oleh akun baru dapat memerlukan status approved untuk mencegah spam.
- Pertimbangkan CAPTCHA/rate limit untuk registrasi dan login sesuai kebijakan serta fitur platform yang tersedia.

## 5. Alur Pengguna

### 5.1 Guest: membuat Twibbon

1. Buka `/c/{slug}`; sistem memvalidasi campaign published dan memuat manifest/template.
2. Jika tidak ada/archived/disabled, tampilkan status tidak tersedia tanpa membocorkan metadata privat.
3. Tampilkan judul singkat, preview template dan tombol **Pilih Foto** tanpa intro atau landing page bertele-tele.
4. Guest memilih file foto melalui file picker sistem operasi.
5. Browser memvalidasi tipe/ukuran, mendecode gambar, menormalkan orientasi jika diperlukan, dan mempersiapkan preview.
6. Foto dirender di bawah template. User dapat drag, pinch zoom, zoom +/- dan rotate, serta reset/ganti foto.
7. Preview memperlihatkan transformasi foto dan frame yang akan keluar saat ekspor; tidak boleh ada gerak pada template.
8. Tekan **Download Twibbon**; browser membuat PNG final pada resolusi template.
9. Setelah Blob dibuat sukses, aplikasi menyediakan tindakan unduh atau berbagi menggunakan kemampuan browser/perangkat; tidak mengklaim file pasti tersimpan.
10. Pencatatan statistik best-effort dan tidak memblokir unduhan. Tombol **Salin Caption** menyalin teks kampanye dengan fallback bila Clipboard API dibatasi.

**Exception:** URL tidak ada, manifest gagal diambil, PNG gagal dimuat/CORS, file foto rusak, tipe tidak didukung (mis. HEIC pada browser tertentu), resolusi ekstrem/RAM tidak cukup, `toBlob()` gagal, clipboard ditolak, penyimpanan dibatalkan, atau jaringan putus. Tampilkan pesan singkat dan tindakan pemulihan; jangan menghapus foto yang sudah dipilih karena error metadata/statistik.

### 5.2 Admin: publikasi kampanye

1. Register → verifikasi email → login → dashboard.
2. Klik **Buat Kampanye**, isi nama/judul, slug (otomatis dengan pilihan ubah), deskripsi opsional dan caption.
3. Upload PNG transparan; jalankan validasi keamanan, format, dimensi, area transparansi, ukuran dan kuota.
4. Preview seperti editor publik; admin mengonfirmasi tampilan bingkai.
5. Simpan sebagai draft. Setelah field wajib valid dan status akun memenuhi kebijakan, klik **Publikasikan**.
6. Sistem menyimpan metadata, menerbitkan manifest publik dan asset URL/path yang valid, lalu menyediakan tautan `/c/{slug}`.
7. Admin dapat copy link, edit, mengganti template (membuat versi aset baru), unpublish/arsip, dan melihat statistik kampanye.
8. Saat logout, halaman privat tidak lagi menampilkan state sensitif.

**Exception:** duplikat slug, file terlalu besar, PNG tanpa transparansi berguna, upload terputus, kuota habis, status akun diblokir, dua update bersamaan, atau manifest belum konsisten. Jangan menyatakan published sukses sebelum data dan manifest publik siap.

### 5.3 Super Admin

Login khusus → dashboard ringkas → daftar admin dan statusnya → seluruh kampanye → moderasi/unpublish/suspend → statistik agregat → pemantauan kuota → logout. Seluruh aksi sensitif diaudit dengan actor, target, waktu dan jenis operasi.

## 6. Functional Requirements (FR)

Setiap requirement di bawah harus dapat ditelusuri ke use case, acceptance criteria, dan test. Prioritas: **M = Must**, **S = Should**, **C = Could**.

| ID | Requirement teruji | Role | Prioritas |
| --- | --- | --- | --- |
| FR-001 | Sistem menyediakan register menggunakan email/password dan verifikasi email | Admin | M |
| FR-002 | Login dan logout aman serta reset password | Admin, Super Admin | M |
| FR-003 | Sistem mengenali role otoritatif dan memblokir akses tenant silang | Admin, Super Admin | M |
| FR-004 | Sistem memungkinkan Admin membuat kampanye draft dengan judul, slug, caption, dan metadata | Admin | M |
| FR-005 | Sistem memvalidasi slug unik secara global dan menghasilkan URL publik | Admin | M |
| FR-006 | Sistem memvalidasi dan menyimpan template PNG milik admin | Admin | M |
| FR-007 | Sistem menampilkan preview transparansi/penempatan template sebelum publish | Admin | M |
| FR-008 | Admin dapat mengubah data kampanye sendiri dan memublikasikan/menonaktifkannya | Admin | M |
| FR-009 | Sistem menampilkan daftar kampanye dan status milik admin | Admin | M |
| FR-010 | Halaman publik hanya menampilkan campaign published yang tidak diblokir | Guest | M |
| FR-011 | User memilih foto dari perangkat, tanpa upload ke server | Guest | M |
| FR-012 | Sistem memvalidasi dan mendecode foto lokal dengan pesan error yang jelas | Guest | M |
| FR-013 | User mengubah translasi, skala, dan rotasi foto; template tidak bisa dimanipulasi | Guest | M |
| FR-014 | User dapat reset atau mengganti foto tanpa reload halaman | Guest | S |
| FR-015 | Sistem menampilkan preview komposit berorientasi output final | Guest | M |
| FR-016 | Sistem mengekspor foto+template ke satu file PNG dengan dimensi template asli | Guest | M |
| FR-017 | Pengunduhan berlangsung tanpa upload foto atau komposit ke cloud | Guest | M |
| FR-018 | User dapat menyalin caption publik | Guest | M |
| FR-019 | Sistem menerima satu event statistik best-effort yang tervalidasi untuk proses unduh | Guest | M |
| FR-020 | Admin melihat jumlah event unduh berdasarkan campaign miliknya | Admin | M |
| FR-021 | Admin melihat tren 7/30 hari dan peringkat campaign sendiri | Admin | S |
| FR-022 | Super Admin melihat seluruh akun/campaign dan statistik agregat | Super Admin | M |
| FR-023 | Super Admin dapat suspend/reactivate akun dan disable kampanye | Super Admin | M |
| FR-024 | Sistem memberlakukan kuota file/penyimpanan/campaign per akun | Admin | M |
| FR-025 | Sistem mengaudit perubahan sensitif dan tindakan moderasi | Admin, Super Admin | S |
| FR-026 | Sistem menyediakan status/error/fallback yang aman pada setiap jalur penting | Semua | M |
| FR-027 | Sistem mendukung pagination/filter ringan untuk daftar admin dan campaign | Admin, Super Admin | S |
| FR-028 | Sistem menyediakan penghapusan akun/data sesuai kebijakan retensi dan relasi kepemilikan | Admin, Super Admin | S |

## 7. Business Rules (BR)

| ID | Aturan |
| --- | --- |
| BR-001 | Guest tidak memerlukan akun untuk menggunakan kampanye published |
| BR-002 | Hanya pemilik atau Super Admin melalui operasi berwenang yang dapat memodifikasi campaign |
| BR-003 | Super Admin tidak dapat didaftarkan melalui form publik |
| BR-004 | Satu campaign MVP menggunakan tepat satu template aktif; pergantian template membuat versi aset baru |
| BR-005 | Slug unik secara global; slug lama tidak boleh dialihkan ke campaign lain secara diam-diam |
| BR-006 | Aset publik campaign published diasumsikan dapat diakses/diekstraksi; tidak ada janji anti-download absolut |
| BR-007 | Gestur di editor hanya mengubah layer foto; file asli template tidak dimanipulasi |
| BR-008 | Tidak ada foto pribadi user atau hasil gabungan yang disimpan server aplikasi |
| BR-009 | Statistik merepresentasikan event unduh yang diterima dan valid, bukan pengguna unik atau jaminan file disimpan |
| BR-010 | Campaign draft/disabled/archived tidak dapat digunakan untuk membuat Twibbon baru melalui halaman publik |
| BR-011 | Publish wajib menunggu template valid, metadata wajib lengkap, dan manifest berhasil diterbitkan |
| BR-012 | File type, dimensi, ukuran, dan jumlah campaign per admin dibatasi oleh konfigurasi platform |
| BR-013 | Admin suspended kehilangan hak tulis tanpa menunggu logout; status campaign terkait mengikuti kebijakan moderasi |
| BR-014 | Tindakan penghapusan mempertimbangkan referensi event, manifest, dan file Storage sehingga tidak meninggalkan orphan asset |

## 8. Non-Functional Requirements (NFR)

| ID | Aspek | Persyaratan / cara verifikasi |
| --- | --- | --- |
| NFR-001 | Mobile-first | Semua alur Guest berfungsi pada viewport HP dan perangkat sentuh; tidak perlu gesture yang hanya tersedia di desktop |
| NFR-002 | Responsiveness | Mobile 320px sampai desktop lebar; editor mempertahankan rasio template dan kontrol tidak saling menutupi |
| NFR-003 | Data privacy | Network audit menunjukkan tidak ada request berisi bytes foto user, base64 foto, atau komposit |
| NFR-004 | Tenant isolation | Uji RLS dan Storage membuktikan Admin A tidak dapat CRUD data Admin B |
| NFR-005 | Authorization | Setiap aksi Super Admin diverifikasi di backend, bukan hanya route guard JS |
| NFR-006 | Image fidelity | Output resolusi asli template; layer template tidak berubah dan hasil sesuai dengan preview |
| NFR-007 | Performance | Tidak ada server-side render foto, realtime tidak diperlukan; budget JS dan p95 ditetapkan lewat pengukuran |
| NFR-008 | Burst usage | Skenario 500 pengunjung berdekatan diuji tanpa kegagalan sistemik atau crash backend akibat event |
| NFR-009 | Resilience | Kegagalan logging event tidak menggagalkan ekspor gambar; fallback pesan untuk gangguan internet |
| NFR-010 | Accessibility | Label tombol, keyboard fallback, fokus terlihat, target sentuh memadai, status error dapat dibaca screen reader |
| NFR-011 | Compatibility | Versi stabil Chrome Android, Safari iOS, Chrome/Firefox/Edge desktop sesuai matriks pengujian |
| NFR-012 | Security | Input validation, CSP sesuai kebutuhan, sanitasi konten dinamis, RLS/policy, rate limit, secret management |
| NFR-013 | Maintainability | Modul tanpa framework besar; setiap domain editor/auth/campaign/api terpisah; test unit untuk matriks transformasi |
| NFR-014 | Observability | Kesehatan layanan, event error anonim, metrik storage/egress/DB dan log error backend tersedia |
| NFR-015 | Cache correctness | Perubahan template tidak memunculkan frame lama; URL aset berversi dan mekanisme perubahan manifest terdefinisi |

**Performance budgets [USULAN awal, bukan janji]:** usahakan file JS/CSS publik sekecil mungkin (cek compression), preconnect hanya ke origin penting, lazy-load kode khusus dashboard, ukur Core Web Vitals di ponsel sungguhan, dan tetapkan SLO numerik setelah tes baseline. Jangan menyamakan 500 visitor, 500 request per second, dan 500 unduhan serentak: skenario itu berbeda.

## 9. UI/UX dan Informasi Halaman

### 9.1 Prinsip desain

Minimalis, flat, bersih, profesional, cepat, tanpa splash screen, animasi dekoratif berat, pop-up tidak perlu, carousel template, testimoni, hero marketing, blog, atau fitur sosial. Fokus satu tujuan per layar. Kontras dan aksesibilitas tetap diperhatikan. Semua copy pendek dalam Bahasa Indonesia.

### 9.2 Rute

| Path | Tujuan | Akses |
| --- | --- | --- |
| `/` | Beranda minimal; dapat berisi identitas singkat + Masuk/Daftar dan cara mengakses campaign; jangan menggantikan editor campaign | Public |
| `/c/:slug` | Editor Twibbon; tautan kampanye utama | Public |
| `/login` | Login Admin/Super Admin | Public |
| `/register` | Registrasi Admin | Public |
| `/forgot-password` | Pemulihan password | Public |
| `/auth/callback` | Callback verifikasi/sesi | Public |
| `/admin` | Ringkasan campaign sendiri | Admin |
| `/admin/campaigns` | Daftar, buat dan edit campaign | Admin |
| `/admin/campaigns/new` | Form create | Admin |
| `/admin/campaigns/:id` | Detail/edit campaign | Owner/Admin |
| `/admin/statistics` | Statistik sendiri | Admin |
| `/admin/settings` | Profil dan akun | Admin |
| `/superadmin` | Overview platform | Super Admin |
| `/superadmin/users` | Kelola admin | Super Admin |
| `/superadmin/campaigns` | Moderasi semua campaign | Super Admin |
| `/superadmin/statistics` | Statistik global | Super Admin |
| `/superadmin/settings` | Konfigurasi kuota moderasi | Super Admin |
| `/*` | 404 ringan | Public |

**Catatan SPA:** Jika memakai Vite + Vanilla JS dengan client-side routing, konfigurasi Vercel rewrite harus mengarahkan path aplikasi ke `index.html` tanpa merusak file asset, sitemap, favicon, dan robots. Alternatif multipage statis boleh dipilih asal direct URL `/c/:slug` berfungsi saat refresh.

### 9.3 Tampilan halaman campaign

Urutan elemen tampilan HP: header logo kecil → judul singkat → canvas rasio template → **Pilih/Ganti Foto** → kontrol +/- / rotate / reset (gestur pinch dan drag) → tombol utama **Download Twibbon** → tombol sekunder **Salin Caption** → bantuan/error singkat bila diperlukan. Jangan menampilkan statistik atau menu admin pada editor publik. Navigasi belakang tidak menghapus file lokal tanpa kebutuhan. Disable unduh hingga foto siap.

**Interaction quality:** area sentuh tidak tumpang tindih dengan scroll halaman; `touch-action` diatur hanya pada area editor; gunakan pointer events untuk drag dan multitouch yang konsisten, passive listener untuk scroll umum; tidak mematikan seluruh context menu/sistem aksesibilitas secara global.

## 10. Spesifikasi Engine Editor Gambar

### 10.1 Input template

- PNG dengan alpha channel/transparansi; tidak menerima SVG, JS, HTML atau file executable sebagai template.
- Umumnya 1080 × 1080, tetapi **[USULAN]** mendukung dimensi dan rasio lain selama lolos validasi dan batas piksel; jangan hardcode 1:1.
- Simpan file original setelah validasi. Optimasi lossless opsional hanya jika transparansi dan keluaran identik secara visual; tidak mengubah resolusi original.
- Batasi ukuran berkas, pixel area, dan dimensi untuk melindungi Storage, bandwidth, serta RAM. Nilai final dikelola lewat konfigurasi dan dites pada HP target; angka kuota awal pada bagian 15.
- Preview upload menampilkan checkerboard atau latar simulasi agar area transparan jelas. Peringatkan jika tidak ada area foto yang berguna.

### 10.2 Input foto pribadi

- File diperoleh dari `<input type="file" accept="image/*">` dengan dukungan mobile file picker/camera sesuai browser.
- Deteksi MIME, magic bytes bila memungkinkan, dan kesuksesan decoding. `accept` saja tidak dianggap validasi.
- JPEG, PNG, WebP jika decoder browser mendukung; HEIC/HEIF ditangani sebagai kasus khusus melalui pesan fallback jika tidak didukung.
- Gunakan Object URL sementara (`URL.createObjectURL`) dan `URL.revokeObjectURL` saat tak dibutuhkan; jangan mengirim bytes ke Storage, API, telemetry, logs, error reporting, atau localStorage/IndexedDB.
- Browser dapat mendecode gambar besar menjadi buffer RGBA yang berkali-kali lebih besar dari ukuran berkas; lakukan downsample untuk preview dan batasi megapiksel guna mencegah crash.
- Pilihan foto tidak boleh tersimpan/tersinkron antarsesi kecuali ada persetujuan dan perubahan kebutuhan formal (di luar MVP).

### 10.3 Model lapisan dan matematika transformasi

Gunakan dua lapisan logis: (1) **foto user** dengan posisi `x,y`, faktor skala `scale`, rotasi `rotation`; (2) **template** tetap dalam koordinat canvas. Semua interaksi mengubah state transformasi foto saja. Saat render final gunakan `clearRect` → transform foto → `drawImage(photo)` → reset transform → `drawImage(template)`; gunakan clipping sesuai dimensi output. Pastikan tidak muncul edge kosong yang tidak diinginkan; tetapkan zoom minimum/maximum dan initial cover-fit behavior secara konsisten. Rotation menggunakan pusat foto atau pusat frame yang didefinisikan secara eksplisit.

**Preview vs output:** CSS canvas ukuran responsif, drawing buffer preview mengikuti ukuran layar dan devicePixelRatio yang aman. Export menggunakan canvas terpisah pada ukuran piksel template asli, dengan transformasi berbasis koordinat ternormalisasi; jangan mengekspor ukuran CSS. Uji foto portrait dan landscape, EXIF orientation, rotasi 90°/180°, pinch center preservation, touch move, scroll, dan interaksi multi-pointer.

### 10.4 Ekspor

- Gunakan `canvas.toBlob('image/png')` dan buat object URL unduhan. Jika browser mendukung fitur share file, dapat ditawarkan nanti sebagai opsi tambahan, bukan dependensi MVP.
- Cek cross-origin template/CORS agar canvas tetap origin-clean; jangan memakai canvas yang sudah terkena taint.
- Nama berkas aman, mis. `fadTwibbon-{slug}.png`.
- Buka/memicu download hanya setelah Blob berhasil dibuat; mobile Safari dapat membuka preview file alih-alih langsung menyimpan—berikan instruksi native sederhana jika diperlukan.
- Hapus object URL dan buffer besar sesudah aman dibebaskan; hindari merevoke sebelum pengguna bisa menyimpan.
- Gagal ekspor memunculkan pesan dan opsi coba ulang/kurangi resolusi foto sumber bila aman; resolusi template original tetap prioritas.

### 10.5 Proteksi template: batas nyata

Template tidak mempunyai tool interaksi di editor dan tidak tersedia tombol download terpisah. Namun **tidak mungkin menjamin original PNG tidak dapat diekstraksi bila file dikirim ke browser**. Base64, disable right-click, overlay, dan obfuscation bukan pengamanan efektif; **jangan membangun klaim '95% terlindungi' atau menggunakan cara-cara tersebut sebagai security control**. Pemilik template menyetujui bahwa kampanye publik melibatkan distribusi aset. Bila asset harus benar-benar dirahasiakan, pendekatan ini perlu ditinjau ulang (server-side compositing bertentangan dengan privacy/no-upload).

## 11. Arsitektur Sistem

### 11.1 Stack

- **Frontend:** HTML5, CSS3, ES Modules JavaScript; gunakan **Vite** sebagai bundler ringan untuk development/build, tanpa React/Vue/Next.js pada MVP. Vanilla JS tetap bahasa utama.
- **Editor:** Canvas 2D API, Pointer Events, browser File/Blob/ObjectURL/Clipboard APIs.
- **Hosting:** Vercel static deployment dan CDN.
- **Source:** GitHub private repository `fadd3079-prog/fadTwibbon`, default branch `main`; PR/feature branches untuk perubahan.
- **Backend:** Supabase Auth, PostgreSQL, Supabase Storage, Edge Functions yang minimal untuk operasi sensitif dan statistik.
- **Authorization:** PostgreSQL RLS, Storage RLS, verifikasi JWT/role pada fungsi privileged.
- **Tidak digunakan di MVP:** Laravel, image rendering backend, persistent sessions khusus guest, websocket/realtime, image database, Redis, VPS, queue server, analytics SDK yang mengoleksi foto.

### 11.2 Aliran data

```text
GitHub main ──deploy──> Vercel CDN ──HTML/CSS/JS──> Browser Guest
                                                       │
Supabase Storage/CDN ──template PNG / manifest publik───┤
                                                       │
Foto dari device ──memory lokal──> Canvas preview/export│
                                                       └──PNG unduh lokal

Guest (event metadata only) ──HTTPS──> Edge Function
                                         └──validate/rate-limit/dedupe──> PostgreSQL

Admin login ──Supabase Auth──> Admin Dashboard
                                 └──RLS/Storage Policies──> campaigns/templates
Super Admin ──strongly authorized server operations──> moderation/quotas
```

### 11.3 Metadata kampanye publik (manifest)

**[USULAN]** Untuk traffic read-heavy, buat JSON publik kecil per kampanye berisi `slug`, `title`, `caption`, `templateUrl`, `templateWidth`, `templateHeight`, `templateVersion`, `publishedAt`. Jangan sertakan email admin, UUID auth yang tidak diperlukan, riwayat perubahan, data privat, atau key rahasia. Manifest dibuat/diupdate hanya lewat proses publish terpercaya. Alur update harus atomik secara logis: upload aset versi baru → validasi → simpan database → terbitkan manifest → tandai published/versi aktif. Jika gagal, rollback/compensating action dan jangan mengumumkan publikasi sukses.

**Pertimbangan:** metadata bisa juga dibaca lewat view/RPC publik ber-RLS dan di-cache; pilih implementasi yang paling sederhana setelah proof-of-concept. Hindari membuat manifest anonim dapat dimodifikasi oleh admin lain. Cache-Control metadata lebih pendek; filename PNG mengandung versi/hash dan long immutable cache. Mekanisme invalidasi ketika disable kampanye harus diuji; public cache TTL berarti deaktivasi mungkin tidak instan. Untuk moderasi yang menuntut blokir seketika, gunakan TTL pendek atau pemeriksaan status server sesuai trade-off request/backend.

### 11.4 Keamanan komponen

- Public frontend hanya memiliki URL dan **publishable/anon key**; jangan pernah memasukkan `service_role` atau secret Supabase ke bundle/Vercel variable prefiks publik.
- Gunakan Supabase RLS aktif pada seluruh tabel non-publik serta Storage policies sesuai operasi dan ownership.
- Operasi superadmin yang memerlukan elevated privileges dilakukan di Edge Function dengan role/session diverifikasi ulang dan authorization server-side; jika memakai service role, jangan mengekspos token/kunci ke klien atau meneruskan input mentah tanpa pemeriksaan.
- Semua event publik harus divalidasi terhadap campaign published dan idempotency token; limit per source berlapis sesuai kapasitas layanan. Tanpa login, statistik tetap bisa dipalsukan oleh bot; tampilkan metrik sebagai perkiraan aktivitas, bukan bukti individual.
- Input judul/caption di-render menggunakan textContent atau escaping benar; jangan memakai `innerHTML` untuk konten admin.
- Pastikan tidak ada pengambilan URL gambar arbitrer yang bisa menyebabkan abuse/SSRF pada backend; gunakan paths di bucket yang dikendalikan aplikasi.

## 12. Database dan Model Data

### 12.1 Model relasional

**`profiles`** (1:1 `auth.users`)
- `user_id uuid primary key` → `auth.users.id`
- `display_name text`, `status text` (`pending`, `active`, `suspended`)
- `created_at timestamptz`, `updated_at timestamptz`
- role jangan dapat diedit pada baris profile; gunakan tabel terpisah.

**`user_roles`** (1:1 user untuk MVP)
- `user_id uuid primary key` → auth user
- `role text` (`admin`, `super_admin`)
- `assigned_at timestamptz`, `assigned_by uuid nullable`
- hanya operasi provisioning/mutasi privileged yang mengubah role.

**`campaigns`**
- `id uuid primary key`, `owner_id uuid not null references profiles(user_id)`
- `title text not null`, `slug text not null unique`, `description text nullable`, `caption text not null default ''`
- `status text not null` (`draft`, `published`, `disabled`, `archived`)
- `template_id uuid nullable` (FK ke `templates` setelah metadata dibuat; hindari circular cascade)
- `published_at timestamptz nullable`, `created_at`, `updated_at`, `disabled_reason nullable`
- index `(owner_id, updated_at desc)` dan `(status, published_at desc)`; slug unique index.

**`templates`**
- `id uuid primary key`, `campaign_id uuid not null references campaigns(id)`
- `storage_path text not null unique`, `version int not null`, `mime_type text not null` (`image/png`)
- `size_bytes bigint not null`, `width int not null`, `height int not null`, `sha256 text nullable`
- `created_at timestamptz not null`, `is_active boolean not null default false`
- batasi satu template aktif per campaign via partial unique index `(campaign_id) where is_active`; konsistensi aktif perlu dijaga transaksi.

**`download_events`**
- `id uuid primary key`, `campaign_id uuid not null references campaigns(id)`
- `event_token text not null unique` (token acak/idempotency, bukan identitas pengguna)
- `created_at timestamptz not null default now()`
- index `(campaign_id, created_at desc)`.

**`campaign_daily_stats`** [USULAN saat volume meningkat]
- `campaign_id uuid`, `stat_date date`, `download_events_count bigint`, `updated_at timestamptz`
- composite PK `(campaign_id, stat_date)`; sumber aggregasi dari event tervalidasi.

**`audit_logs`** [USULAN]
- `id uuid`, `actor_id uuid`, `action text`, `target_type text`, `target_id uuid`, `created_at timestamptz`, `metadata jsonb` terbatas dan tanpa rahasia.

**`platform_settings`** [USULAN]
- `key text primary key`, `value jsonb`, `updated_at`; hanya Super Admin berhak ubah; default kuota juga dapat disimpan konfigurasi backend agar implementasi lebih sederhana.

### 12.2 Kardinalitas dan kebijakan data

- `auth.users` 1:1 `profiles`, 1:1 `user_roles` pada MVP.
- `profiles` 1:N `campaigns`.
- `campaigns` 1:N `templates` (riwayat versi); tepat satu aktif pada satu waktu.
- `campaigns` 1:N `download_events`, dan 1:N `campaign_daily_stats`.
- Statistik unduh tidak menyimpan foto, nama, email peserta, persistent browser fingerprint, atau IP pada tabel aplikasi. Infrastruktur/vendor dapat memiliki access logs tersendiri sesuai kebijakan mereka; jangan menyatakan tidak ada IP di seluruh lapisan jaringan.

### 12.3 RLS dan penyimpanan

| Data/aksi | Anon | Admin owner | Other Admin | Super Admin |
| --- | --- | --- | --- | --- |
| `campaigns` published public projection | Read limited fields | Read | Read limited fields | Read all |
| Campaign draft/edit/delete | No | Own only | No | Elevated server operation |
| Templates metadata private | No | Own only | No | Elevated server operation |
| Template public assets for published campaign | Read asset distributed | Read | Read | Read |
| Own download stats | No | Read own | No | Read all |
| Direct insert `download_events` from browser | **No** | No | No | Use validated function |
| Set any user role | No | No | No | Privileged function/provisioning |

**Implementation note:** jangan buat kebijakan `USING (true)` untuk seluruh campaign dan berasumsi kolom sensitif tersembunyi. Gunakan public manifest/view yang membatasi kolom atau fungsi aman. Storage path `templates/{owner_id}/{campaign_id}/{version}-{hash}.png` merupakan organisasi file, bukan bukti otorisasi; cek ownership DB dalam policy/privileged operation. Storage bucket dapat public untuk aset published yang memang akan didistribusikan, tetapi upload/delete selalu protected. Keputusan memisahkan bucket `drafts` (private) dan `published-templates` (public) adalah **[USULAN]** terbaik jika aset draft tidak boleh terbuka; perhatikan penyimpanan ganda saat copy dan cleanup.

## 13. Statistik: definisi dan ketepatan

**Metrik utama:** `recorded_download_actions` = jumlah event sah yang backend terima ketika browser sukses membuat PNG dan memulai alur download. Tidak menyatakan file tersimpan atau jumlah manusia unik. Jumlah bisa lebih kecil bila request gagal/offline, atau lebih besar bila orang yang sama mengunduh berulang.

**Event flow:** Blob PNG dibuat → user mengaktifkan download → kirim event metadata `{campaignId, eventToken}` via `sendBeacon`/`fetch` best-effort dengan timeout → Edge Function validasi campaign + payload + rate limit + dedupe → insert idempotent. Event token baru per aksi user; pengiriman ulang event yang sama tidak boleh dihitung dua kali. Jangan kirim Blob, nama file lokal, EXIF, foto, maupun caption sebagai analytics payload.

**Skalabilitas:** hindari 500 query pembuatan PNG (tidak ada backend rendering). Untuk 500 event hampir sekaligus, bottleneck tersisa adalah Edge Function/database insert. Mulai dengan satu insert ringan berindeks dan idempotent; jika beban terukur tinggi, tambahkan batching/agregasi/pembatasan. Jangan menjalankan query `count(*)` seluruh raw events setiap dashboard dibuka saat data sudah besar. Gunakan `campaign_daily_stats` dengan job batch atau upsert terkontrol sesuai risiko konsistensi; pertahankan definisi statistik yang jelas.

**Abuse caveat:** Pengunjung tanpa login dapat memalsukan download events. Cegah penyalahgunaan wajar dengan validasi server, limit berbasis sumber yang meminimalkan data, CAPTCHA hanya jika diperlukan, alarm pola anomali; jangan menjanjikan anti-fraud absolut.

## 14. Skalabilitas dan Kapasitas 500 Pengguna

### 14.1 Karakteristik beban

500 pengunjung membuka link kampanye bersamaan **tidak sama** dengan 500 user mengunduh persis pada detik yang sama. Beban dibagi:

1. CDN Vercel: HTML/CSS/JS yang sama, mudah di-cache.
2. CDN Supabase: file template dan manifest publik; beban utama bandwidth/egress.
3. Browser pengguna: seluruh CPU/RAM decoding foto, drag, rotate, compositing dan export.
4. Backend: autentikasi admin (jarang dibanding guest) dan event statistik unduh.

### 14.2 Optimasi wajib

- Jangan memanggil Supabase saat drag, pinch, zoom, rotate, atau redraw preview.
- Hindari mengambil data public lewat banyak query join berulang; manifest JSON kecil sekali per page load dan cache.
- Cache aset PNG menggunakan URL dengan versi/hash sehingga immutable; gunakan invalidasi/TTL manifest yang aman.
- Render preview pada resolusi sesuai layar, bukan membuat canvas 1080px penuh pada setiap event pointer; batasi `requestAnimationFrame` saat gesture.
- Export baru saat user klik unduh; hindari render PNG besar terus-menerus.
- Minimize JS/CSS, font dan dependency eksternal; dashboard dibuat chunk/entry tersendiri dari editor.
- Batasi ukuran/pixel template dan foto untuk mencegah memory exhaustion pada browser low-end.
- Database mempunyai indeks tepat; hindari N+1; query statistik dioptimasi dan paginated.
- Tidak ada pemrosesan gambar ataupun upload foto peserta di server.

### 14.3 Kalkulasi anggaran transfer (estimasi, bukan hasil load test)

Jika satu PNG 1080px berukuran 1 MB dan 500 pengunjung baru mengambilnya masing-masing satu kali, transfer aset tersebut sekitar **500 MB** di jaringan CDN/provider, belum termasuk kode frontend, data lain, cache misses, retries, dan overhead. Jika aset 2 MB, sekitar 1 GB. Storage 1 GB tidak otomatis berarti boleh transfer tak terbatas. Cache mengurangi beban origin tetapi tidak selalu menghilangkan perhitungan egress provider. Ukur penggunaan sebelum kampanye besar.

### 14.4 Uji beban [VALIDASI]

- Jalankan bertahap: 25 → 50 → 100 → 250 → 500 virtual users, gunakan environment staging dan hormati kebijakan load testing Vercel/Supabase; jangan menjalankan bombardir terhadap layanan produksi tanpa izin.
- Pisahkan tes **A**: kunjungan + pengambilan manifest/template; **B**: 500 event download; **C**: skenario admin CRUD + publish saat ada traffic; **D**: browser sungguhan pada HP untuk rendering/memory.
- Catat HTTP error rate, p50/p95 latency, bytes transferred, cache hit rate, bandwidth total, event acceptance/duplicate rate, CPU/memory browser dan crash, database active connections, serta kuota paket.
- **Release gate:** tidak ada kegagalan sistemik; threshold kuantitatif p95/error ditetapkan bersama setelah baseline dan kondisi jaringan ditentukan. Jika ada limit tercapai, kurangi traffic/backend calls atau revisi kapasitas/hosting sebelum mengklaim kesiapan produksi.

## 15. Kuota, Biaya, dan Perencanaan Operasi

**Data layanan gratis berubah**; nilai berikut merupakan referensi dokumentasi resmi yang dicek pada tahap penulisan dan wajib diverifikasi lagi saat setup/deploy:

- Supabase Free: **Database 500 MB per project; Storage 1 GB; 50.000 Monthly Active Users untuk Auth; 500.000 Edge Function invocations; egress uncached 5 GB dan cached 5 GB** dengan ketentuan kuota terkait yang dapat berubah.
- Vercel Hobby: untuk penggunaan personal **non-komersial**; deployment dan transfer memiliki kebijakan serta kuota fair-use. Bila proyek dipakai untuk tujuan komersial, cek paket/penyedia hosting yang diizinkan sebelum peluncuran.
- Free tier tidak menjamin SLA enterprise, high availability, atau melayani traffic tanpa batas; batas dapat berubah dan project free yang tidak aktif dapat dijeda.

**Kuota produk internal [USULAN awal, dapat dikonfigurasi]:**

- Maksimum **5 campaign published per admin** dan **10 campaign total per admin** pada MVP.
- Maksimum **3 MB/template PNG**, maksimum **4096px pada setiap sisi**, dan maksimum **16 megapiksel** untuk template; ekspor 1080px adalah kasus standar.
- Maksimum **10 MB untuk foto input** dan batas megapiksel decode/preview berdasarkan kemampuan browser; file hanya diproses lokal.
- Maksimum **1 template aktif per campaign** dan simpan paling banyak **2 versi terdahulu** selama masa grace period jika kapasitas memungkinkan.
- **Peringatan operasional** pada estimasi 70% dan 90% penggunaan Storage/egress/database; threshold ini usulan, bukan fitur otomatis bawaan.

Jangan menerapkan kuota hanya lewat UI; validasi upload, jumlah campaign, dan ukuran file dilakukan melalui operasi server/Storage policy yang dapat dipertanggungjawabkan. Jika pembuatan file dan insert metadata membutuhkan beberapa langkah, terapkan cleanup terjadwal/rekonsiliasi untuk mencegah orphan files. Pemilik platform perlu dapat menyesuaikan kuota saat traffic riil diketahui.

## 16. API/Integration Contract (konseptual)

Kontrak operasional final dapat menggunakan Supabase SDK, RPC, Storage API, dan Edge Functions; hindari endpoint khusus jika operation dapat diamankan secara langsung menggunakan RLS.

| Operasi | Pelaksana | Proteksi | Respons penting |
| --- | --- | --- | --- |
| Auth register/login/logout | Supabase Auth | Email verification, Auth rate limits | User session/state |
| Create/update draft campaign | Supabase DB/RPC | Auth + owner RLS | Campaign ID/status |
| Validate/upload template | Storage + privileged validation | Auth, owner + limit | Template path, metadata |
| Publish/unpublish | Trusted RPC/Edge Function | Owner/admin status + transaction logic | Published status/manifest version |
| Read public manifest | Public CDN | Hanya published | Metadata publik minimum |
| Download event | Edge Function | Rate limit, payload validation, idempotency | 202/204-like acknowledgment |
| Read own analytics | DB view/RPC | Owner RLS | Counts by campaign/date |
| Manage users/moderate | Privileged Edge Function | Verified super_admin authorization + audit | Operation result |

**Error model:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `STORAGE_ERROR`, `SERVICE_UNAVAILABLE`; tampilkan pesan bersahabat dan jangan membocorkan trace atau SQL detail pada pengguna.

## 17. Acceptance Criteria (AC) dan Matriks Traceability Awal

Gunakan pola Given–When–Then agar implementasi dan pengujian dapat dibuktikan.

| AC | Terkait | Kriteria penerimaan |
| --- | --- | --- |
| AC-001 | FR-001/002 | Given email baru valid, when register dan verifikasi selesai, then Admin bisa login; tanpa verifikasi akses privileged ditolak |
| AC-002 | FR-003 | Given Admin A, when mencoba ubah campaign Admin B via API langsung, then request ditolak dan data tetap utuh |
| AC-003 | FR-004/005 | Given slug dipakai, when admin publish slug sama, then sistem menolak dengan pesan konflik dan tidak membuat dua URL identik |
| AC-004 | FR-006/007 | Given PNG valid, when admin upload, then preview cocok ukuran/alpha; file yang tidak valid ditolak tanpa orphan |
| AC-005 | FR-008/010 | Given campaign draft/disabled, when guest membuka URL, then editor tidak disajikan sebagai campaign aktif |
| AC-006 | FR-011 | Given user memilih foto, when mengedit dan mengunduh, then tidak ada request berisi bytes foto/hasil ke server |
| AC-007 | FR-013 | Given template ter-render, when drag/pinch/rotate, then transform foto berubah sedangkan koordinat template tetap |
| AC-008 | FR-015/016 | Given PNG template 1080x1080, when export selesai, then file PNG 1080x1080 dan tampilan sesuai preview |
| AC-009 | FR-017 | Given event analytics error/offline, when Blob berhasil dibuat, then user tetap dapat memakai unduhan |
| AC-010 | FR-018 | Given caption publik, when tekan Salin Caption, then teks clipboard sama dan fallback tersedia jika akses ditolak |
| AC-011 | FR-019 | Given event token sudah disimpan, when request sama dikirim ulang, then count tidak bertambah dua kali |
| AC-012 | FR-020 | Given dua Admin, when Admin A membuka statistik, then hanya campaign milik A muncul |
| AC-013 | FR-022/023 | Given user role Admin, when mengakses operasi suspend user, then request ditolak; Super Admin yang berwenang berhasil |
| AC-014 | FR-024 | Given batas campaign/file terlampaui, when upload/create, then operasi ditolak sebelum melanggar kuota |
| AC-015 | NFR-008 | Given beban staging bertahap sampai 500 VU, when jalankan skenario terdefinisi, then tidak ada kegagalan sistemik dan metrik memenuhi gate yang telah divalidasi |
| AC-016 | NFR-011 | Given matriks browser target, when test alur penuh, then tidak ada defect blocker dan error penting tertangani |

**Requirement Traceability Matrix awal:**

| Kebutuhan nilai | Problem/Constraint | Artefak perilaku | FR utama | AC utama |
| --- | --- | --- | --- | --- |
| Guest membuat Twibbon mudah | UX mobile/privacy | UC-Guest-01, Activity-Editor | FR-010–018 | AC-006–010 |
| Admin mengelola campaign | Autonomi pemilik template | UC-Admin-01, BPMN Publish | FR-001–009 | AC-001,003–005 |
| Isolasi data multi-tenant | Security | UC-Admin-02, Access Matrix | FR-003,020 | AC-002,012 |
| Supervisi platform | Moderation | UC-Super-01 | FR-022–025 | AC-013,014 |
| Statistik ringan | Visibility/scale | BPMN Download Event | FR-019–021 | AC-009,011 |
| Lonjakan 500 pengguna | Performance/cost | Deployment/Load Model | NFR-007–009 | AC-015 |

Untuk baseline SRS formal, buat dokumen `SRS.md` terpisah dengan seluruh ID stabil, narasi use case lengkap, BPMN As-Is berbasis observasi (jangan dibuat sebagai fakta tanpa discovery), BPMN To-Be, Activity Diagram, ERD, RTM lengkap, review defect dan revision log.

## 18. Modul dan Rencana Struktur Repository

```text
fadTwibbon/
├── PRD.md
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── vite.config.js
├── vercel.json
├── index.html
├── public/
│   ├── favicon.ico
│   └── icons/
├── src/
│   ├── main.js
│   ├── styles/
│   │   ├── base.css
│   │   ├── components.css
│   │   └── editor.css
│   ├── pages/
│   │   ├── home.js
│   │   ├── campaign.js
│   │   ├── login.js
│   │   ├── register.js
│   │   ├── admin.js
│   │   └── superadmin.js
│   ├── components/
│   │   ├── button.js
│   │   ├── dialog.js
│   │   └── notification.js
│   ├── editor/
│   │   ├── image-loader.js
│   │   ├── geometry.js
│   │   ├── gestures.js
│   │   ├── renderer.js
│   │   └── exporter.js
│   ├── services/
│   │   ├── supabase.js
│   │   ├── auth.js
│   │   ├── campaigns.js
│   │   ├── templates.js
│   │   └── analytics.js
│   └── utils/
│       ├── validation.js
│       ├── format.js
│       └── errors.js
├── supabase/
│   ├── migrations/
│   ├── functions/
│   │   ├── record-download/
│   │   └── privileged-admin/
│   └── seed.sql
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── load/
└── docs/
    ├── SRS.md
    ├── ARCHITECTURE.md
    ├── ERD.md
    ├── THREAT_MODEL.md
    ├── RUNBOOK.md
    └── CHANGELOG.md
```

Struktur di atas adalah **target usulan**, bukan kewajiban membuat semua file sekaligus. Buat modul hanya ketika fasenya dikerjakan. Hindari abstraksi berlebihan dan dependency yang tidak diperlukan. Pembangunan dimulai dengan editor kecil yang dapat diuji, lalu backend dan admin secara bertahap.

## 19. Environment, CI/CD dan Deployment

### 19.1 Lingkungan

- Local: `npm install`, `npm run dev`; gunakan `.env.local` tidak dilacak Git.
- Staging/Preview: deploy PR branch untuk pengujian; gunakan project/bucket test dan data dummy jika kuota memungkinkan.
- Production: `main` deploy ke Vercel domain yang dipilih nanti; database production dan Storage dijaga dari destructive testing.
- Simpan hanya `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` sebagai variabel browser-exposed; seluruh credential privileged berada di secret backend/Edge Function, tidak di prefiks VITE.
- Atur URL Auth callback dan allowed redirects untuk localhost, preview yang terpercaya, dan domain production; hindari wildcard terbuka.

### 19.2 Workflow Git

- Branch `main` untuk production; perubahan melalui `feature/*` dan pull request bila memungkinkan.
- Commit spesifik (contoh `feat: add canvas editor`), minimal lint/test/build sebelum merge.
- Jangan commit `.env`, token, password, file foto pribadi, `.supabase` secrets, atau data production.
- Database migration SQL harus versioned dan dapat diulang; dokumentasikan migration rollback/backup.
- Repo GitHub sudah diidentifikasi sebagai `fadd3079-prog/fadTwibbon`; PRD tidak otomatis di-commit kecuali diminta pengguna.

### 19.3 Pipeline minimum

Lint/format/check static → unit tests → integration/RLS tests pada environment test → production build → preview smoke test → deploy `main` → verify URL langsung ke `/c/slug`, login, image export dan statistik.

## 20. Security, Privacy dan Risiko Operasional

### 20.1 Kontrol wajib

- RLS di semua tabel berisi data tenant, serta Storage access policy di semua operasi tulis/baca private.
- Jangan expose service role secret, token admin, atau API secret melalui frontend.
- Idempotency/rate limit untuk event publik, validasi payload sederhana, dan pembatasan abuse.
- Verifikasi upload PNG server-side sejauh memungkinkan, cek content signature serta pixel/resource limits; jangan menganggap ekstensi dan MIME input sepenuhnya terpercaya.
- Secure response headers termasuk CSP yang kompatibel dengan Supabase/Vercel dan testing; no inline script jika memungkinkan.
- Hindari DOM XSS saat menampilkan caption/nama kampanye.
- Error logs tidak mengandung bytes foto, token autentikasi, atau informasi pengguna yang tidak diperlukan.
- Proses penghapusan akun dan aset memperhitungkan retensi, backup dan kebijakan layanan.

### 20.2 Risiko, konsekuensi, mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Traffic viral melebihi cached/uncached egress | Template tidak dapat dimuat / kuota habis | Monitoring kuota, cache URL versioned, batas ukuran template, rencana upgrade/fallback |
| Request event palsu / bot | Statistik menyesatkan, beban DB | Validation, dedupe, rate limit, penjelasan metrik |
| Policy RLS keliru | Data antar admin bocor/terubah | RLS test matrix setiap migrasi, deny-by-default |
| Template dari tenant lain terhapus | Kehilangan kampanye | Ownership check, soft-disable, audit, backup aset seperlunya |
| Foto 20–50 MP membuat HP hang | Crash browser, user gagal unduh | Decode limits, downsample preview, export strategi memori, uji perangkat |
| CDN cache stale saat unpublish | Konten disabled masih tampil sementara | TTL manifest pendek, jalur moderasi khusus, documented tradeoff |
| Image canvas tainted | Export gagal | Atur CORS dan origin clean template, uji cross-origin |
| CDN/provider outage | Campaign gagal dimuat | Pesan error, cache aset secara wajar, dokumentasi recovery |
| Supabase Free dijeda/terbatas | Admin, metadata, event terganggu | Pantau aktivitas, backup, opsi upgrade/migrasi |
| Vercel Hobby digunakan komersial | Pelanggaran kebijakan layanan | Konfirmasi kategori penggunaan sebelum launch; upgrade atau pindah host |
| Admin spam/upload tidak sah | Storage & reputasi habis | Quota, verifikasi email, approval/moderation, abuse reporting |
| Klaim anti-download tidak benar | Ekspektasi pemilik aset salah | Pernyataan eksplisit keterbatasan browser-side asset secrecy |

## 21. Testing Strategy

### 21.1 Unit tests

- Transformasi matematika center/crop/scale/rotation dan inverse pointer mapping.
- Validasi file size, dimensions, slug, caption, status transitions.
- Idempotency event dan normalisasi tanggal zona waktu untuk statistik.

### 21.2 Integration tests

- RLS dengan anon, Admin A, Admin B, Super Admin dan suspended Admin.
- Storage CRUD ownership, versioned publish dan cleanup orphan.
- Register/login/logout/reset; Auth redirects.
- Manifest creation/update/disable dan cache correctness.
- Edge Function event valid/invalid/duplicate/flood.

### 21.3 End-to-end tests

- Register→verify→login→create draft→upload PNG→publish→share.
- Guest→open URL→pick local photo→drag→pinch→rotate→reset→export PNG→copy caption.
- Admin A tidak melihat/mengedit kampanye B.
- Super Admin suspend account dan efek ke sesi/operasi.
- Network offline setelah template ter-cache, statistik gagal namun unduhan tidak terganggu.
- Unsupported photo/huge image/CORS/clipboard denied.

### 21.4 Visual/device matrix

Chrome Android (mid/low-end), Safari iOS, Chrome/Firefox/Edge desktop; portrait/landscape phone, 320px viewport, high-DPI, dark/light OS, touch scrolling, screen reader/keyboard. Verifikasi pixel output dan tidak ada cropping template karena layout.

### 21.5 Definition of Done

- Semua Must FR dan AC terkait lolos di staging.
- Tidak ada blocker security/RLS atau upload foto ke backend.
- Tidak ada defect blocker di device matrix.
- Uji burst + monitoring tidak menunjukkan ketidakstabilan sistemik, dan threshold yang disepakati terpenuhi.
- Tidak ada secret di bundle/repo, migration terdokumentasi, cleanup Storage dan runbook tersedia.
- Product owner mereview minimal satu flow Admin dan satu flow Guest.

## 22. Fase Pengembangan dan Urutan Implementasi

**Phase 0 — Discovery dan baseline:** validasi asumsi, scope, stakeholder, interface low fidelity; sepakati manifest/cache, anti-fraud minimum, kuota dan proses publish; SRS draft + RTM awal.

**Phase 1 — Public editor offline-capable core:** bangun editor dengan satu template contoh lokal, pilih foto, preview, drag, zoom, rotate, reset, PNG export; lakukan test pada HP. Jangan hubungkan backend sebelum engine matang.

**Phase 2 — Backend foundation:** Supabase project/config, Auth, database migration, RLS, Storage bucket/policy, role provisioning, integration tests.

**Phase 3 — Admin multi-tenant:** register/login/logout, dashboard, CRUD campaign sendiri, upload+preview template, draft/publish, manifest, share URL, quotas.

**Phase 4 — Public campaign + statistik:** `/c/:slug` load manifest/template via CDN, capture validated download events, dashboard counts + grafik, graceful failure.

**Phase 5 — Super Admin:** moderation, suspend, monitoring global, audit, kontrol kuota; uji operasi privileged.

**Phase 6 — Hardening & release:** security review, performance budgeting, browser matrix, staged traffic tests, biaya/egress monitoring, privacy/terms, runbook, launch.

**Change control:** Setelah PRD disetujui, perubahan FR/BR/NFR/DB/flows harus menyertakan alasan, dampak, owner, revisi dokumen, dan pembaruan RTM/test. Tidak perlu membuat semua halaman/modul sekaligus.

## 23. Prioritas MVP

**P0 — tidak boleh rilis tanpa:** privacy no-upload, stable canvas editor, PNG output asli, public campaign URL, admin auth+ownership, secure upload template, create/publish/unpublish, RLS, basic counts, proper errors, dan uji keamanan.

**P1 — sebaiknya sebelum digunakan banyak admin:** dashboard superadmin, suspension/moderation, kuota, laporan 7/30 hari, event dedupe/rate limit, browser matrix, dan load test 500 visitors.

**P2 — setelah traffic nyata:** analytics lanjutan, advanced abuse controls, multi-template variant, scheduled publish, custom domain per admin, campaign archive policy, share-native improvements, dan granular billing/quotas. Semua membutuhkan proposal scope baru.

## 24. Keputusan Arsitektur (ADR)

| ID | Keputusan | Alasan | Trade-off |
| --- | --- | --- | --- |
| ADR-001 | Vanilla JS + Vite | Ringan, mudah dirawat, tidak perlu framework besar untuk editor | Manual state/router perlu disiplin |
| ADR-002 | Canvas compositing di browser | Foto tetap lokal, server tidak memproses gambar | RAM/compatibility tergantung perangkat |
| ADR-003 | Template dipublikasikan sebagai PNG original ter-cache | Kualitas 1080px terjaga, URL mudah didistribusikan | File tidak dapat dijamin rahasia |
| ADR-004 | Supabase Auth/Postgres/Storage | Layanan terintegrasi, RLS, tanpa VPS | Kuota gratis dan vendor dependency |
| ADR-005 | Vercel static CDN | Deployment GitHub sederhana, scale read-heavy | Hobby nonkomersial; service limits |
| ADR-006 | Multi-tenant owner_id + RLS | Satu backend untuk banyak Admin dengan isolasi | Policy dan privileged operations harus diuji |
| ADR-007 | Best-effort analytics via Edge Function | Tak memblokir download, memberi observabilitas | Event bisa hilang/dipalsukan; bukan orang unik |
| ADR-008 | Manifest publik yang dapat di-cache [USULAN] | Mengurangi DB reads pada traffic tinggi | Cache invalidation/atomic publish lebih rumit |
| ADR-009 | Filename template immutable/versioned | CDN cache panjang tanpa stale asset setelah update | Perlu cleanup versi lama |
| ADR-010 | Super Admin backend-verified | Mencegah privilege escalation | Membutuhkan function/provisioning khusus |

## 25. Open Questions dan Decision Log

| ID | Pertanyaan / keputusan tertunda | Status |
| --- | --- | --- |
| TBD-01 | Apakah registrasi admin terbuka langsung, atau harus di-approve Super Admin sebelum publish? | USULAN: verifikasi + approval |
| TBD-02 | Apakah publik boleh menemukan kampanye lewat home, atau hanya via link? | USULAN: hanya via link untuk MVP |
| TBD-03 | Apakah admin dapat mengubah slug setelah published? Perlu redirect lama? | USULAN: slug immutable setelah publish |
| TBD-04 | Apakah semua rasio template didukung? | USULAN: arbitrary aspect ratio terkontrol, standar 1080² |
| TBD-05 | Kuota file/campaign/versions per admin | USULAN angka awal bagian 15 |
| TBD-06 | Apakah Super Admin dapat mengedit isi campaign atau hanya moderasi? | USULAN: moderasi dan intervensi melalui operasi diaudit |
| TBD-07 | Cara tepat menerbitkan manifest/invalidasi cache di paket gratis | Proof of concept |
| TBD-08 | Kebijakan retensi raw events dan statistik harian | Validasi privacy + kapasitas DB |
| TBD-09 | Target p95 latency dan error rate untuk 500 visitors | Tentukan setelah staging measurements |
| TBD-10 | Nama domain produk dan kebijakan penggunaan komersial | Belum ditentukan |
| TBD-11 | Apakah user boleh membagikan file melalui native share button? | P2 opsional |
| TBD-12 | Perlukah moderasi hak cipta/laporan penyalahgunaan konten? | Ya sebelum pendaftaran luas; detail TBD |

## 26. Referensi dan Asal Kebutuhan

**Basis analisis akademik dari materi yang diberikan pemilik produk:** IF21307 Analisis dan Desain Sistem Pertemuan 1–7, contoh Project Charter, dan contoh SRS. Struktur konseptual: *evidence/discovery → pain point dan As-Is → requirements FR/NFR/BR/AC → BPMN To-Be → Use Case/Activity → RTM → review dan baseline*. Contoh PDF bersifat format/metodologi pembelajaran; tidak dianggap sebagai bukti empiris bahwa suatu pain point benar terjadi pada fadTwibbon.

**Referensi teknis internasional (cek versi terkini saat implementasi):**

- Supabase Storage Access Control — https://supabase.com/docs/guides/storage/security/access-control
- Supabase Bandwidth & Storage Egress — https://supabase.com/docs/guides/storage/serving/bandwidth
- Supabase Billing and Free Plan — https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase Database Size — https://supabase.com/docs/guides/platform/database-size
- Vercel Hobby Plan — https://vercel.com/docs/plans/hobby
- Vercel Limits — https://vercel.com/docs/limits
- Vercel Fair Use — https://vercel.com/docs/limits/fair-use-guidelines
- MDN Canvas API / CanvasRenderingContext2D / HTMLCanvasElement.toBlob / File API / Pointer Events / Clipboard API — https://developer.mozilla.org/
- OWASP ASVS / Cheat Sheet Series — https://owasp.org/

## 27. Document Ownership, Revision dan Baseline

| Versi | Tanggal | Perubahan | Status |
| --- | --- | --- | --- |
| 1.0-draft | 2026-10-08 | Dokumen PRD lengkap untuk fadTwibbon berdasarkan brief dan analisis awal | Menunggu review pemilik produk |

**Kriteria baseline:** semua TBD yang berdampak pada izin, kontrak API, privasi, publikasi, biaya, dan security ditetapkan/ditandai eksplisit; diagram dan AC tidak bertentangan; risiko terbesar punya mitigasi; stakeholder menyetujui scope; baru setelah itu pindahkan versi dokumen ke `1.0-approved` dan rujuk dalam SRS serta backlog implementasi.

---

**Final product principle:** *A user selects a photo locally, edits it locally, exports a faithful Twibbon locally. Admins manage their own campaigns securely. Super Admin oversees the platform. The backend stores only what is needed, and the public editor is fast, minimal, and privacy-preserving.*
