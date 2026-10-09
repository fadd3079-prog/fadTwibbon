import '@fontsource-variable/geist';
import './styles/base.css';
import './styles/editor.css';
import { el,link,button,status,message,errorText } from './utils/ui.js';
import { configured, supabase } from './services/supabase.js';
import { themeControl } from './utils/theme.js';
import { LogIn,LogOut } from 'lucide';

const app = document.getElementById('app');
let destroy = () => {}, request = null, sequence = 0, authSubscription, dashboardSession=null;
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
  const path = location.pathname.replace(/\/$/,'') || '/';
  if (dashboardSession?.matches(path)) { document.title='fadTwibbon'; await dashboardSession.show(path); return; }
  const seq = ++sequence;
  destroy(); destroy = () => {}; dashboardSession=null; request?.abort(); request = new AbortController();
  document.title='fadTwibbon';
  const main = el('main',{ id:'main',tabindex:'-1' });
  const publicEditor = path.startsWith('/c/');
  const authRoute=['/login','/register','/forgot-password','/reset-password','/auth/callback'].includes(path);
  const header = el('header',{ class:'site-header' },el('div',{ class:'inner' },el('a',{ class:'brand',href:'/' },'fad',el('span',{},'Twibbon'))));
  if (!publicEditor && !authRoute) header.querySelector('.inner').append(el('nav',{ 'aria-label':'Akun' },link('Masuk','/login','',LogIn)));
  header.querySelector('.inner').append(themeControl());
  const footer = el('footer',{ class:'site-footer' },el('span',{},'fadTwibbon'),el('nav',{ 'aria-label':'Informasi' },link('Privasi','/privacy'),link('Ketentuan','/terms')));
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
      header.querySelector('.inner nav').replaceChildren(button('Keluar',async () => { try { await signOut(); navigate('/login',true); } catch { navigate('/login',true); } },'header-action',LogOut));
      if (!viewer.verified || (viewer.status==='suspended' && !(viewer.deletion_pending && path==='/admin/settings'))) page=el('div',{},el('h1',{},'Akun tidak dapat digunakan'),el('p',{},viewer.deletion_pending?'Penghapusan akun belum selesai. Coba ulang untuk melanjutkan pembersihan.':viewer.status==='suspended'?'Akun Anda ditangguhkan. Hubungi pengelola platform.':'Verifikasi email Anda sebelum mengakses dashboard.'),viewer.deletion_pending?link('Lanjutkan penghapusan','/admin/settings','button'):null);
      else if (path.startsWith('/superadmin') && viewer.role!=='super_admin') page=el('div',{ class:'state-page' },el('h1',{},'Akses ditolak'),el('p',{},'Akun ini tidak memiliki izin untuk mengelola platform.'),link('Kembali ke kampanye','/admin','button'));
      else {
        dashboardSession=(await import('./pages/dashboard.js')).createDashboardLayout(viewer,navigate);
        await dashboardSession.show(path); page=dashboardSession;
      }
    } else page=el('div',{ class:'state-page' },el('p',{ class:'kicker' },'404'),el('h1',{},'Halaman tidak ditemukan.'),el('p',{},'Periksa alamat yang Anda buka.'),link('Kembali ke beranda','/','button'));
    if (seq!==sequence) { page?.destroy?.(); return; }
    main.replaceChildren(page.root || page);
    const cleanup=page.destroy || (() => {}); destroy=() => { cleanup(); if (dashboardSession===page) dashboardSession=null; };
    if (seq>1) { const heading=main.querySelector('h1'); if (heading) { heading.tabIndex=-1; heading.focus({ preventScroll:true }); } }
    window.scrollTo(0,0);
  } catch (error) {
    if (seq!==sequence || error.name==='AbortError') return;
    main.replaceChildren(el('div',{ class:'state-page' },el('p',{ class:'kicker' },error.message==='NOT_FOUND'?'Kampanye':'Gangguan layanan'),el('h1',{},error.message==='NOT_FOUND'?'Kampanye tidak ditemukan.':'Gagal memuat halaman.'),el('p',{ role:'alert' },errorText(error)),el('div',{ class:'actions' },button('Coba lagi',() => void route()),link('Kembali ke beranda','/','button'))));
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
