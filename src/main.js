import './styles/base.css';
import './styles/editor.css';
import { el,link,button,status,message,errorText } from './utils/ui.js';
import { configured, supabase } from './services/supabase.js';

const app = document.getElementById('app');
let destroy = () => {}, request = null, sequence = 0, authSubscription;
export function navigate(path, replace = false) {
  if (replace) history.replaceState({},'',path); else history.pushState({},'',path);
  void route();
}
document.addEventListener('click',(event) => {
  const a = event.target.closest('a[href]');
  if (!a || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || a.target || a.hasAttribute('download')) return;
  const url = new URL(a.href);
  if (url.origin===location.origin && !url.hash) { event.preventDefault(); navigate(url.pathname+url.search); }
});
window.addEventListener('popstate',() => void route());

async function route() {
  const seq = ++sequence;
  destroy(); destroy = () => {}; request?.abort(); request = new AbortController();
  const path = location.pathname.replace(/\/$/,'') || '/';
  document.title='fadTwibbon';
  const main = el('main',{ id:'main',tabindex:'-1' });
  const publicEditor = path.startsWith('/c/');
  const header = el('header',{ class:'site-header' },el('div',{ class:'inner' },el('a',{ class:'brand',href:'/' },'fad',el('span',{},'Twibbon'))));
  if (!publicEditor) header.querySelector('.inner').append(el('nav',{ 'aria-label':'Akun' },link('Masuk','/login')));
  const footer = el('footer',{ class:'site-footer' },link('Privasi','/privacy'),link('Ketentuan','/terms'));
  app.replaceChildren(header,main,footer);
  const loading=status(); message(loading,publicEditor?'Memuat kampanye…':'Memuat halaman…'); main.append(loading);
  try {
    let page;
    if (path==='/') page=(await import('./pages/home.js')).homePage(navigate);
    else if (path==='/privacy' || path==='/terms') page=(await import('./pages/home.js')).legalPage(path==='/privacy');
    else if (!configured) page=el('div',{},el('h1',{},'Layanan belum terhubung'),el('p',{},'Konfigurasi Supabase belum tersedia. Pengelola perlu mengisi variabel lingkungan sebelum aplikasi digunakan.'),link('Ke beranda','/'));
    else if (/^\/c\/[a-z0-9-]+$/.test(path)) page=await (await import('./pages/campaign.js')).campaignPage(path.slice(3),request.signal);
    else if (['/login','/register','/forgot-password','/reset-password'].includes(path)) {
      await watchAuth();
      const modes={ '/login':'login','/register':'register','/forgot-password':'forgot','/reset-password':'reset' };
      page=await (await import('./pages/auth.js')).authPage(modes[path],navigate);
    } else if (path==='/auth/callback') {
      await watchAuth(); page=await (await import('./pages/auth.js')).callbackPage(navigate);
    } else if (path.startsWith('/admin') || path.startsWith('/superadmin')) {
      await watchAuth();
      const { context,signOut } = await import('./services/auth.js');
      const viewer=await context();
      if (!viewer) { navigate('/login',true); return; }
      header.querySelector('.inner nav').replaceChildren(button('Keluar',async () => { main.replaceChildren(el('p',{},'Keluar…')); try { await signOut(); navigate('/login',true); } catch { navigate('/login',true); } }));
      if (!viewer.verified || viewer.status==='suspended') page=el('div',{},el('h1',{},'Akun tidak dapat digunakan'),el('p',{},viewer.status==='suspended'?'Akun Anda ditangguhkan. Hubungi pengelola platform.':'Verifikasi email Anda sebelum mengakses dashboard.'));
      else if (path.startsWith('/superadmin') && viewer.role!=='super_admin') page=el('div',{},el('h1',{},'Akses ditolak'),link('Dashboard Anda','/admin'));
      else page=await (await import('./pages/dashboard.js')).dashboardPage(path,viewer,navigate);
    } else page=el('div',{},el('h1',{},'Halaman tidak ditemukan'),link('Ke beranda','/'));
    if (seq!==sequence) { page?.destroy?.(); return; }
    main.replaceChildren(page.root || page); destroy=page.destroy || (() => {});
    main.focus({ preventScroll:true }); window.scrollTo(0,0);
  } catch (error) {
    if (seq!==sequence || error.name==='AbortError') return;
    main.replaceChildren(el('h1',{},error.message==='NOT_FOUND'?'Kampanye tidak tersedia':'Halaman gagal dimuat'),el('p',{ role:'alert' },errorText(error)),button('Coba lagi',() => void route()),link('Ke beranda','/','button'));
  }
}

async function watchAuth() {
  if (authSubscription) return;
  authSubscription=(await supabase()).auth.onAuthStateChange((event) => {
    if (event==='SIGNED_OUT' && /^\/(admin|superadmin)/.test(location.pathname)) queueMicrotask(() => navigate('/login',true));
    if (event==='PASSWORD_RECOVERY') queueMicrotask(() => navigate('/reset-password',true));
  }).data.subscription;
}
void route();
