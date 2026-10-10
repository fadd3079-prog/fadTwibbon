import '@fontsource-variable/geist';
import './styles/base.css';
import './styles/editor.css';
import { el,link,button,status,message,errorText } from './utils/ui.js';
import { configured } from './services/supabase.js';
import { initializeAuth,context,signOut } from './services/auth.js';
import { createHeader } from './components/header.js';
import { setMetadata } from './utils/metadata.js';
import { LogOut } from 'lucide';

const app = document.getElementById('app');
let destroy = () => {}, request = null, sequence = 0, dashboardSession=null,headerComponent;
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
window.addEventListener('auth:recovery',() => navigate('/reset-password',true));

async function route() {
  const path = location.pathname.replace(/\/$/,'') || '/';
  setMetadata(path);
  if (dashboardSession?.matches(path)) { await dashboardSession.show(path); return; }
  const seq = ++sequence;
  destroy(); destroy = () => {}; dashboardSession=null; request?.abort(); request = new AbortController();
  const main = el('main',{ id:'main',tabindex:'-1' });
  headerComponent?.destroy();
  headerComponent=createHeader(navigate,path);
  const footer = el('footer',{ class:'site-footer' },el('span',{},'fadTwibbon'),el('nav',{ 'aria-label':'Informasi' },link('Privasi','/privacy'),link('Ketentuan','/terms')));
  app.replaceChildren(headerComponent.root,main,footer);
  const publicEditor = path.startsWith('/c/');
  const loading=status(); message(loading,publicEditor?'Memuat kampanye…':'Memuat halaman…'); main.append(loading);
  try {
    if (configured) await initializeAuth().catch(() => {});
    let page;
    if (path==='/') page=(await import('./pages/home.js')).homePage(navigate);
    else if (path==='/privacy' || path==='/terms') page=(await import('./pages/home.js')).legalPage(path==='/privacy');
    else if (!configured) page=el('div',{ class:'state-page' },el('h1',{},'Layanan Belum Terhubung'),el('p',{},'Konfigurasi Supabase belum tersedia.'),link('Ke Beranda','/','button'));
    else if (/^\/c\/[a-z0-9-]+$/.test(path)) {
      page=await (await import('./pages/campaign.js')).campaignPage(path.slice(3),request.signal);
      setMetadata(path,page.campaign);
    } else if (['/login','/register','/forgot-password','/reset-password'].includes(path)) {
      const viewer=await context();
      if (viewer && path!=='/reset-password') { navigate(viewer.role==='super_admin'?'/superadmin':'/admin',true); return; }
      const modes={ '/login':'login','/register':'register','/forgot-password':'forgot','/reset-password':'reset' };
      page=await (await import('./pages/auth.js')).authPage(modes[path],navigate);
    } else if (path==='/auth/callback') page=await (await import('./pages/auth.js')).callbackPage(navigate);
    else if (path.startsWith('/admin') || path.startsWith('/superadmin')) {
      const viewer=await context();
      if (!viewer) { navigate('/login',true); return; }
      const nav=headerComponent.root.querySelector('.header-nav');
      const logout=nav?.querySelector('.header-signout');
      if (logout) logout.replaceWith(button('Keluar',async () => { await signOut(); navigate('/login',true); },'header-signout',LogOut));
      if (!viewer.verified || (viewer.status==='suspended' && !(viewer.deletion_pending && path==='/admin/settings'))) page=el('div',{ class:'state-page' },el('h1',{},'Akun Tidak Dapat Digunakan'),el('p',{},viewer.deletion_pending?'Penghapusan akun belum selesai. Coba ulang untuk melanjutkan.':viewer.status==='suspended'?'Akun Anda ditangguhkan. Hubungi pengelola platform.':'Verifikasi email sebelum membuka Dashboard.'),viewer.deletion_pending?link('Lanjutkan Penghapusan','/admin/settings','button'):null);
      else if (path.startsWith('/superadmin') && viewer.role!=='super_admin') page=el('div',{ class:'state-page' },el('h1',{},'Akses Ditolak'),el('p',{},'Akun ini tidak memiliki izin untuk mengelola platform.'),link('Kembali ke Kampanye','/admin','button'));
      else {
        dashboardSession=(await import('./pages/dashboard.js')).createDashboardLayout(viewer,navigate);
        await dashboardSession.show(path); page=dashboardSession;
      }
    } else page=el('div',{ class:'state-page' },el('p',{ class:'kicker' },'404'),el('h1',{},'Halaman Tidak Ditemukan'),el('p',{},'Periksa alamat yang Anda buka.'),link('Kembali ke Beranda','/','button'));
    if (seq!==sequence) { page?.destroy?.(); return; }
    main.replaceChildren(page.root || page);
    const cleanup=page.destroy || (() => {}); destroy=() => { cleanup(); if (dashboardSession===page) dashboardSession=null; };
    if (seq>1) { const heading=main.querySelector('h1'); if (heading) { heading.tabIndex=-1; heading.focus({ preventScroll:true }); } }
    window.scrollTo(0,0);
  } catch (error) {
    if (seq!==sequence || error.name==='AbortError') return;
    main.replaceChildren(el('div',{ class:'state-page' },el('p',{ class:'kicker' },error.message==='NOT_FOUND'?'Kampanye':'Gangguan Layanan'),el('h1',{},error.message==='NOT_FOUND'?'Kampanye Tidak Ditemukan':'Gagal Memuat Halaman'),el('p',{ role:'alert' },errorText(error)),el('div',{ class:'actions' },button('Coba Lagi',() => void route()),link('Kembali ke Beranda','/','button'))));
  }
}
void route();
