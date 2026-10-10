import { el, link, button, field, status, busy, message, errorText } from '../utils/ui.js';
import { supabase } from '../services/supabase.js';
import { establishSession,refreshAuth } from '../services/auth.js';
import { Eye,EyeOff } from 'lucide';
import { icon } from '../components/icon.js';

const destination = (viewer) => viewer?.role==='super_admin'?'/superadmin':'/admin';

export async function authPage(mode, navigate) {
  const titles = { login:'Masuk', register:'Daftar', forgot:'Pulihkan Password', reset:'Buat Password Baru' };
  const descriptions={ login:'Kelola kampanye kamu.',register:'Buat akun pengelola.',forgot:'Masukkan email akun kamu.',reset:'Gunakan minimal 12 karakter.' };
  const feedback = status();
  const form = el('form', { class:'auth-form' });
  const heading=el('div',{ class:'auth-heading' },el('p',{ class:'kicker' },'fadTwibbon'),el('h1', {}, titles[mode]),el('p',{},descriptions[mode]));
  const root = el('div', { class:'auth-page' },heading,form,feedback);
  const inputs = {};
  const add = (label,name,attrs) => { const f = field(label,name,attrs); inputs[name]=f.input; form.append(f.wrap); return f; };
  if (mode==='register') add('Nama','display_name',{ required:true,maxlength:100,autocomplete:'name' });
  if (mode!=='reset') add('Email','email',{ type:'email',required:true,autocomplete:'email',inputmode:'email' });
  if (mode==='login' || mode==='register' || mode==='reset') {
    const password=add('Password','password',{ type:'password',required:true,minlength:mode==='login'?1:12,maxlength:128,autocomplete:mode==='login'?'current-password':'new-password',help:mode==='login'?null:'Minimal 12 karakter.' });
    const toggle=button('Tampilkan',() => { const visible=password.input.type==='text'; password.input.type=visible?'password':'text'; toggle.querySelector('svg').replaceWith(icon(visible?Eye:EyeOff)); toggle.querySelector('span').textContent=visible?'Tampilkan':'Sembunyikan'; toggle.setAttribute('aria-pressed',String(!visible)); },'password-toggle',Eye);
    toggle.setAttribute('aria-pressed','false'); password.wrap.append(toggle); password.wrap.classList.add('password-field');
  }
  if (mode==='register') form.append(el('label',{ class:'check' },el('input',{ type:'checkbox',required:true }),el('span',{},'Saya setuju dengan ',link('Ketentuan','/terms'),' dan ',link('Privasi','/privacy'),'.')));
  const submit = el('button',{ type:'submit',class:'primary' },mode==='forgot'?'Kirim Link':mode==='reset'?'Simpan Password':titles[mode]); form.append(submit);

  function verification(email) {
    const note=status();
    const otp=el('input',{ id:'email-otp',name:'email-otp',type:'text',required:true,inputmode:'numeric',autocomplete:'one-time-code',pattern:'[0-9]{6}',minlength:'6','aria-describedby':'otp-help' });
    const verify=el('button',{ type:'submit',class:'primary' },'Verifikasi');
    const otpForm=el('form',{ class:'auth-form otp-form' },el('div',{ class:'field' },el('label',{ for:'email-otp' },'Kode Verifikasi'),otp,el('small',{ id:'otp-help' },`Kode dikirim ke ${email}`)),verify);
    let remaining=60,timer;
    const resend=button('Kirim Ulang Kode',async () => {
      resend.disabled=true; message(note,'Memproses…');
      try {
        const { error }=await (await supabase()).auth.resend({ type:'signup',email });
        if (error) throw error;
        message(note,'Kode baru sudah dikirim.'); startCooldown();
      } catch (error) { message(note,errorText(error),true); startCooldown(); }
    });
    function startCooldown() {
      clearInterval(timer); remaining=60; resend.disabled=true; resend.querySelector('span').textContent=`Kirim Ulang Kode (${remaining})`;
      timer=setInterval(() => { remaining--; resend.querySelector('span').textContent=remaining?`Kirim Ulang Kode (${remaining})`:'Kirim Ulang Kode'; if (!remaining) { clearInterval(timer); resend.disabled=false; } },1000);
    }
    otp.addEventListener('input',() => { otp.value=otp.value.replace(/\D/g,'').slice(0,6); });
    otpForm.addEventListener('submit',(event) => {
      event.preventDefault();
      void busy(verify,note,async () => {
        const db=await supabase();
        const { data,error }=await db.auth.verifyOtp({ email,token:otp.value,type:'signup' });
        if (error) throw error;
        const viewer=await establishSession(data.session);
        clearInterval(timer); navigate(destination(viewer),true);
      });
    });
    startCooldown();
    root.replaceChildren(el('div',{ class:'auth-confirmation' },el('p',{ class:'kicker' },'Verifikasi Email'),el('h1',{},'Verifikasi Email'),el('p',{},'Masukkan 6 digit kode yang dikirim ke email kamu.'),otpForm,resend,note,link('Kembali ke Masuk','/login','auth-back')));
    otp.focus();
  }

  form.addEventListener('submit',(event) => {
    event.preventDefault();
    void busy(submit,feedback,async () => {
      const db = await supabase(); let result;
      if (mode==='register') result=await db.auth.signUp({ email:inputs.email.value.trim(),password:inputs.password.value,options:{ data:{ display_name:inputs.display_name.value.trim() } } });
      if (mode==='login') result=await db.auth.signInWithPassword({ email:inputs.email.value.trim(),password:inputs.password.value });
      if (mode==='forgot') result=await db.auth.resetPasswordForEmail(inputs.email.value.trim(),{ redirectTo:`${location.origin}/reset-password` });
      if (mode==='reset') result=await db.auth.updateUser({ password:inputs.password.value });
      if (result.error) throw result.error;
      if (mode==='login') {
        const viewer=await establishSession(result.data.session);
        navigate(destination(viewer),true);
      } else if (mode==='register') verification(inputs.email.value.trim());
      else if (mode==='reset') { await db.auth.signOut(); navigate('/login?password=updated',true); }
      else { form.reset(); message(feedback,'Kalau email terdaftar, link pemulihan akan dikirim.'); }
    });
  });
  if (mode==='login') root.append(el('nav',{ class:'auth-links','aria-label':'Bantuan masuk' },link('Lupa Password?','/forgot-password'),link('Daftar','/register')));
  else root.append(link('Kembali ke Masuk','/login','auth-back'));
  if (mode==='login' && new URLSearchParams(location.search).has('password')) message(feedback,'Password sudah diubah. Silakan masuk.');
  if (mode==='reset') {
    const { data:{ session } } = await (await supabase()).auth.getSession();
    if (!session) form.replaceChildren(el('p',{},'Link pemulihan sudah tidak berlaku.'),link('Kirim Link Baru','/forgot-password'));
  }
  return root;
}

export async function callbackPage(navigate) {
  const db = await supabase();
  const query = new URLSearchParams(location.search);
  const callbackError=query.get('error_description') || query.get('error');
  if (callbackError) return callbackFailure('Link Tidak Berlaku','Link verifikasi sudah kedaluwarsa atau pernah dipakai.');
  let { data:{ session },error } = await db.auth.getSession();
  const code=query.get('code');
  if (!session && code) {
    const exchanged=await db.auth.exchangeCodeForSession(code);
    session=exchanged.data?.session;
    error=exchanged.error;
  }
  if (error || !session) return callbackFailure('Verifikasi Selesai','Buka fadTwibbon di browser ini lalu masuk dengan akun yang sudah diverifikasi.');
  history.replaceState({},'',location.pathname);
  try {
    const viewer=await establishSession(session) || await refreshAuth();
    navigate(destination(viewer),true);
  } catch {
    return callbackFailure('Akun Sudah Terverifikasi','Sesi aktif, tetapi data akun belum bisa dimuat. Coba masuk lagi.');
  }
  return el('p',{ role:'status' },'Membuka Dashboard…');
}

function callbackFailure(title,text) {
  return el('div',{ class:'state-page' },el('h1',{},title),el('p',{},text),link('Masuk','/login','button primary'));
}
