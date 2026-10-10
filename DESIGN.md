# fadTwibbon Design System

## Arah

**Minimal, Atmospheric, Fast, Functional.** fadTwibbon adalah alat kreatif singkat, bukan landing page pemasaran. Satu layar memiliki satu fokus: editor menonjolkan kanvas, Dashboard menonjolkan data dan tindakan.

Dial: **ENERGY 1 / RHYTHM 2 / MOTION 1**.

## Identitas

- Monokrom menjadi bahasa utama. Hierarki dibangun lewat kontras, ruang, berat teks, dan kepadatan.
- Gradient grayscale beropacity rendah hanya memberi kedalaman pada halaman publik dan auth.
- Workspace serta kanvas tetap netral agar template menjadi visual utama.
- Geist Sans dipakai karena jelas pada ukuran UI kecil dan sudah tersedia lokal.
- Lucide dipakai untuk tindakan dan navigasi yang relevan. Label tetap hadir kecuali nama aksesibel sudah cukup.

## Warna

### Light

| Token | Nilai | Fungsi |
| --- | --- | --- |
| `paper` | `#EEEEEE` | Latar utama |
| `surface` | `#FFFFFF` | Form, panel, dialog |
| `surface-inset` | turunan `#EEEEEE` | Area sekunder |
| `text` | `#383838` | Teks utama |
| `muted` | `#5C5C5C` | Teks sekunder |
| `border` | turunan `#AEAEAE` | Pemisah halus |
| `primary` | `#383838` | Aksi utama |
| `primary-hover` | `#000000` | Hover aksi utama |
| `focus` | `#5C5C5C` | Focus ring |

### Dark

| Token | Nilai | Fungsi |
| --- | --- | --- |
| `paper` | `#383838` | Latar utama |
| `surface` | `#404040` | Form, panel, dialog |
| `surface-inset` | turunan `#5C5C5C` | Area sekunder |
| `text` | `#EEEEEE` | Teks utama |
| `muted` | `#C0C0C0` | Teks sekunder |
| `border` | `#5C5C5C` | Pemisah |
| `primary` | `#EEEEEE` | Aksi utama |
| `primary-hover` | `#FFFFFF` | Hover aksi utama |
| `on-primary` | `#383838` | Teks pada aksi utama |
| `focus` | `#C0C0C0` | Focus ring |

Palet dasar: `#EEEEEE`, `#AEAEAE`, `#909090`, `#5C5C5C`, `#383838`, `#FFFFFF`, `#C0C0C0`, `#808080`, `#404040`, dan `#000000`.

Warna semantik hanya untuk status: merah untuk error/destruktif, hijau untuk sukses, amber untuk warning/pending, biru untuk informasi. Status selalu memakai teks, bukan warna saja.

## Tipografi dan Spacing

- Font: Geist Sans, fallback system sans-serif.
- Berat: 420–650.
- Heading tanpa uppercase dekoratif.
- Spacing: `4, 8, 12, 16, 24, 32, 48, 64px`.
- Header: 64px desktop, 56px mobile.
- Button: 40px desktop, minimum 44px untuk target sentuh.
- Input: minimum 44px.
- Radius: 8px kontrol, 12px panel, 16px dialog.
- Transisi: 140ms. Nonaktif saat `prefers-reduced-motion`.

## Komponen

- **Primary button:** gelap pada light theme, terang pada dark theme. Satu primary per kelompok tindakan.
- **Secondary button:** surface dengan border.
- **Ghost button:** tanpa border untuk tindakan rendah prioritas.
- **Destructive button:** merah dan selalu memakai konfirmasi bila permanen.
- **Field:** label terlihat, help text hanya bila dibutuhkan, error dekat input.
- **Panel:** border tipis; shadow hanya untuk dialog, menu, atau kanvas yang butuh elevasi.
- **Dialog:** native `<dialog>`, fokus awal aman, Escape menutup.
- **Feedback:** `role=status` untuk progres/sukses, `role=alert` untuk error.
- **Loading:** lokal pada kontrol atau area konten. Shell Dashboard tidak dibongkar.

## Layout dan Responsive

- Header sejajar stabil pada semua rute.
- Editor desktop memakai kanvas dan kontrol berdampingan; mobile menumpuk kanvas lalu kontrol.
- Dashboard memakai seluruh lebar dengan sidebar. Di bawah 860px sidebar berubah menjadi navigasi horizontal.
- Tabel berubah menjadi daftar berlabel di bawah 600px.
- Tidak ada overflow horizontal pada 320px atau 200% zoom.
- Target sentuh minimum 44px.

## Interaksi

- Login dan verifikasi yang sukses langsung membuka Dashboard tanpa layar sukses tambahan.
- Loading singkat tampil pada tombol yang sedang bekerja.
- Sesi auth menjadi satu sumber state untuk header dan routing.
- Menu mendukung keyboard, Escape, klik luar, dan fokus terlihat.
- Tidak ada animasi dekoratif, gradient bergerak, atau delay buatan.

## UX Writing

Gunakan Bahasa Indonesia natural dengan istilah yang sudah familiar:

- Masuk, Daftar, Dashboard, Kampanye
- Buat Kampanye, Edit Kampanye
- Upload Template, Preview
- Pilih Foto, Ganti Foto
- Download Twibbon, Copy Caption
- Salin Link, Simpan, Terbitkan, Keluar
- Email, Password, Link

Title Case untuk judul, navigasi, dan tindakan. Sentence case untuk bantuan, status, dan error. Copy harus singkat, akurat, tanpa slogan, emoji, slang paksa, klaim performa, atau penjelasan teknis yang selalu terbuka.

## Alasan Utama

- Grayscale menjaga template kampanye sebagai sumber warna utama.
- Kontras menggantikan aksen warna agar tindakan tetap jelas dan stabil lintas tema.
- Gradient grayscale memberi atmosfer tanpa mengubah identitas monokrom.
- Border menggantikan shadow pada panel agar halaman ringan dan tenang.
- Rhythm 2 membedakan halaman publik dan workspace tanpa layout acak.
- Motion 1 memberi feedback tanpa memperlambat pekerjaan.
