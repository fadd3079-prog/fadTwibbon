import { el, link, field } from '../utils/ui.js';

export function homePage(navigate) {
  const slug = field('Slug kampanye','campaign-slug',{ required:true,pattern:'[a-z0-9]+(-[a-z0-9]+)*',minlength:3,maxlength:64,placeholder:'slug-dari-tautan-kampanye' });
  const form = el('form',{ class:'open-campaign' },slug.wrap,el('button',{ type:'submit',class:'primary' },'Buka kampanye'));
  form.addEventListener('submit',(event) => { event.preventDefault(); navigate(`/c/${slug.input.value}`); });
  return el('div',{ class:'home-page' },
    el('section',{ class:'hero' },
      el('h1',{},'Tunjukkan dukunganmu.'),
      el('p',{},'Pilih kampanye, pasang fotomu pada bingkai, dan bagikan ke semua orang.'),
      el('div',{ class:'cta-row' },link('Jelajahi kampanye','#buka','button primary'))
    ),
    el('div',{ id:'buka',class:'card' },el('h2',{},'Buka kampanye'),el('p',{},'Gunakan tautan dari penyelenggara, atau masukkan slug kampanye di bawah ini.'),form),
    el('section',{ class:'organizer card' },el('h2',{},'Mengelola kampanye?'),el('p',{},'Unggah bingkai PNG, tulis caption, lalu bagikan tautannya.'),el('div',{ class:'actions' },link('Masuk admin','/login','button'),link('Daftar admin','/register','button primary')))
  );
}

export function legalPage(privacy) {
  return el('article',{ class:'prose' },el('h1',{},privacy?'Privasi':'Ketentuan penggunaan'),...(privacy ? [
    el('p',{},'Foto peserta dan PNG hasil komposisi hanya diproses dalam memori browser. Aplikasi tidak mengunggah atau menyimpan foto tersebut di server. Foto dilepas saat halaman editor ditutup.'),
    el('p',{},'Supabase menyimpan email dan akun pengelola, kampanye, template PNG, serta statistik aktivitas unduh. Statistik berisi ID kampanye, token acak per tindakan, dan waktu, tanpa foto, nama berkas, atau identitas peserta.'),
    el('p',{},'Pembatasan event memakai hash sumber jaringan yang berganti setiap hari dan dihapus setelah satu hari. Event mentah disimpan 30 hari, agregat harian selama kampanye ada, dan audit pengelolaan 180 hari. Supabase dan Vercel dapat memiliki log jaringan serta backup dengan retensi mereka sendiri.'),
    el('p',{},'Sesi pengelola disimpan di browser untuk mempertahankan login. Tidak ada penyimpanan foto peserta, fingerprint browser, maupun analytics pihak ketiga. Hapus akun melalui Pengaturan setelah masuk untuk menghapus data aktif; backup penyedia mengikuti masa retensinya.'),
  ] : [
    el('p',{},'Pengelola harus memiliki hak atas template dan teks yang dipublikasikan. Jangan mengunggah konten ilegal, menyesatkan, atau melanggar hak orang lain. Pengelola platform dapat menangguhkan akun dan menonaktifkan kampanye.'),
    el('p',{},'Template kampanye publik dikirim ke browser dan dapat diekstraksi. Aplikasi mengunci layer template pada editor, bukan menjamin kerahasiaan berkas yang telah dipublikasikan.'),
    el('p',{},'Statistik menghitung aktivitas unduh yang diterima server, bukan jumlah orang unik atau jaminan berkas tersimpan. Jaringan terputus dan pembatasan trafik dapat membuat pencatatan tidak lengkap.'),
    el('p',{},'Kampanye dapat tidak tersedia saat layanan terganggu atau kuota habis. Simpan salinan template asli. Kebijakan dan kontak operasional pemilik perlu ditetapkan sebelum membuka layanan secara luas.'),
  ]));
}
