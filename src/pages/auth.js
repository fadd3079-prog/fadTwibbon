import { el, link, field, status, busy, message } from '../utils/ui.js';
import { supabase } from '../services/supabase.js';
import { context, callbackUrl } from '../services/auth.js';

export async function authPage(mode, navigate) {
  const titles = { login:'Masuk', register:'Daftar sebagai admin', forgot:'Lupa kata sandi', reset:'Atur kata sandi baru' };
  const feedback = status();
  const form = el('form', { class:'auth-form' });
  const root = el('div', { class:'auth-page' }, el('h1', {}, titles[mode]), form, feedback);
  const inputs = {};
  const add = (label,name,attrs) => { const f = field(label,name,attrs); inputs[name]=f.input; form.append(f.wrap); };
  if (mode==='register') add('Nama pengelola','display_name',{ required:true,maxlength:100,autocomplete:'name' });
  if (mode!=='reset') add('Email','email',{ type:'email',required:true,autocomplete:'email',inputmode:'email' });
  if (mode==='login' || mode==='register' || mode==='reset') add('Kata sandi','password',{ type:'password',required:true,minlength:mode==='login'?1:12,maxlength:128,autocomplete:mode==='login'?'current-password':'new-password',help:mode==='login'?null:'Gunakan minimal 12 karakter.' });
  if (mode==='register') {
    form.append(el('p', { class:'hint' }, 'Verifikasi email untuk membuat draft. Publikasi memerlukan persetujuan pengelola platform.'));
    form.append(el('label',{ class:'check' },el('input',{ type:'checkbox',required:true }),el('span',{},'Saya menyetujui ',link('Ketentuan','/terms'),' dan ',link('Privasi','/privacy'),'.')));
  }
  const submit = el('button',{ type:'submit',class:'primary' },mode==='forgot'?'Kirim tautan pemulihan':mode==='reset'?'Simpan kata sandi':titles[mode]); form.append(submit);
  form.addEventListener('submit',(event) => {
    event.preventDefault();
    busy(submit,feedback,async () => {
      const db = await supabase(); let result;
      if (mode==='register') result=await db.auth.signUp({ email:inputs.email.value.trim(),password:inputs.password.value,options:{ emailRedirectTo:callbackUrl(),data:{ display_name:inputs.display_name.value.trim() } } });
      if (mode==='login') result=await db.auth.signInWithPassword({ email:inputs.email.value.trim(),password:inputs.password.value });
      if (mode==='forgot') result=await db.auth.resetPasswordForEmail(inputs.email.value.trim(),{ redirectTo:`${location.origin}/reset-password` });
      if (mode==='reset') result=await db.auth.updateUser({ password:inputs.password.value });
      if (result.error) throw result.error;
      if (mode==='login') { const viewer = await context(); navigate(viewer?.role==='super_admin'?'/superadmin':'/admin'); }
      else if (mode==='reset') { await db.auth.signOut(); navigate('/login?password=updated'); }
      else { form.reset(); message(feedback,mode==='register'?'Periksa email Anda untuk verifikasi. Jika sudah terdaftar, silakan masuk.':'Jika email terdaftar, tautan pemulihan akan dikirim. Periksa juga folder spam.'); }
    });
  });
  if (mode==='login') root.append(el('nav',{ class:'auth-links','aria-label':'Bantuan masuk' },link('Lupa kata sandi?','/forgot-password'),link('Daftar admin','/register')));
  else root.append(link('Kembali ke masuk','/login'));
  if (mode==='login' && new URLSearchParams(location.search).has('password')) message(feedback,'Kata sandi diperbarui. Silakan masuk kembali.');
  if (mode==='reset') {
    const { data:{ session } } = await (await supabase()).auth.getSession();
    if (!session) { form.replaceChildren(el('p',{},'Tautan pemulihan tidak valid atau sudah kedaluwarsa.'),link('Kirim tautan baru','/forgot-password')); }
  }
  return root;
}

export async function callbackPage(navigate) {
  const db = await supabase();
  const query = new URLSearchParams(location.search);
  if (query.get('error') || new URLSearchParams(location.hash.slice(1)).get('error')) return el('div',{},el('h1',{},'Tautan tidak berlaku'),el('p',{},'Tautan verifikasi kedaluwarsa atau sudah digunakan.'),link('Kembali ke masuk','/login'));
  const { data:{ session },error } = await db.auth.getSession();
  if (error || !session) return el('div',{},el('h1',{},'Verifikasi belum selesai'),el('p',{},'Buka tautan dari email di browser yang sama saat mendaftar.'),link('Masuk','/login'));
  history.replaceState({},'',location.pathname);
  const viewer = await context();
  navigate(viewer?.role==='super_admin'?'/superadmin':'/admin',true);
  return el('p',{},'Membuka dashboard…');
}
