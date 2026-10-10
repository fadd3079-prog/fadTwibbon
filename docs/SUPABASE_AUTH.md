# Konfigurasi Supabase Auth

## Hosted project

Buka **Supabase Dashboard > Authentication > Email Templates > Confirm signup**.

Subject:

```text
Kode verifikasi fadTwibbon
```

Body:

```html
<h2>Verifikasi Email</h2>
<p>Masukkan kode berikut di fadTwibbon:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>Kode ini berlaku selama 60 menit. Abaikan email ini jika kamu tidak mendaftar.</p>
```

Jangan gunakan `{{ .ConfirmationURL }}` pada template Confirm signup. Frontend memverifikasi `{{ .Token }}` dengan `verifyOtp({ email, token, type: 'signup' })`.

Di **Authentication > Sign In / Providers > Email**:

- Enable Email provider: aktif
- Confirm email: aktif
- Minimum password length: 12
- OTP length: 6
- OTP expiry: 3600 detik
- Minimum resend interval: 60 detik

Gunakan SMTP produksi untuk pengiriman nyata. Batas bawaan Supabase untuk email uji rendah dan bukan layanan email produksi. Periksa **Authentication > Rate Limits** sebelum rilis. Aktifkan CAPTCHA saat registrasi publik mulai menerima penyalahgunaan; jangan menurunkan batas resend di bawah 60 detik.

## Perilaku akun

- Signup baru membuat role `admin` dan profil `pending` lewat trigger database.
- OTP signup hanya mengonfirmasi email dan membuat sesi. OTP ini bukan passwordless login.
- Jangan mengganti alur dengan `signInWithOtp()`, karena API itu dapat membuat akun baru bila opsi pembuatan akun tidak dibatasi.
- Email yang sudah terdaftar dapat menghasilkan respons signup yang disamarkan oleh Supabase. UI tidak boleh mengungkap apakah email terdaftar.
- `publish_campaign` tetap menolak akun selain `active` dengan `APPROVAL_REQUIRED`.
- `moderate_account` hanya dapat dipanggil Superadmin, menolak self-approval, dan tidak dapat mengubah akun Superadmin.

Konfigurasi lokal memakai `supabase/templates/confirmation.html`. Perubahan template hosted harus diterapkan manual melalui Dashboard atau Management API dengan kredensial operator, bukan dari frontend.
