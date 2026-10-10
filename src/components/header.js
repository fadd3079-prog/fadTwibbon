import { LogIn,LogOut,Menu,Settings,UserPlus,X } from 'lucide';
import { el,link,button } from '../utils/ui.js';
import { subscribeAuth,signOut } from '../services/auth.js';
import { themeControl } from '../utils/theme.js';
import { icon } from './icon.js';

export function createHeader(navigate,path=location.pathname) {
  const brand=el('a',{ class:'brand',href:'/' },'fad',el('span',{},'Twibbon'));
  const navigation=el('nav',{ class:'header-nav','aria-label':'Akun' });
  const menuButton=button('Buka Menu',() => setOpen(!open),'icon-button menu-toggle',Menu);
  menuButton.setAttribute('aria-expanded','false');
  menuButton.setAttribute('aria-controls','account-menu');
  const controls=el('div',{ class:'header-controls' },themeControl(),menuButton);
  const inner=el('div',{ class:'inner' },brand,navigation,controls);
  const root=el('header',{ class:'site-header' },inner);
  let open=false;

  function setOpen(next) {
    open=next;
    navigation.classList.toggle('is-open',open);
    menuButton.setAttribute('aria-expanded',String(open));
    menuButton.replaceChildren(icon(open?X:Menu),el('span',{},open?'Tutup Menu':'Buka Menu'));
    if (open) navigation.querySelector('a,button')?.focus();
  }
  function render(state) {
    const authPage=['/login','/register','/forgot-password','/reset-password','/auth/callback'].includes(path);
    if (authPage) { navigation.replaceChildren(); menuButton.hidden=true; return; }
    menuButton.hidden=false;
    if (state.status==='loading') {
      navigation.replaceChildren(el('span',{ class:'header-session','aria-label':'Memeriksa sesi' },'Memuat…'));
      return;
    }
    if (state.viewer) {
      const base=state.viewer.role==='super_admin'?'/superadmin':'/admin';
      navigation.replaceChildren(...[
        link('Dashboard',base),
        path.startsWith(base)?null:link('Pengaturan',`${base}/settings`,'',Settings),
        button('Keluar',async () => { await signOut(); setOpen(false); navigate('/',true); },'header-signout',LogOut)
      ].filter(Boolean));
    } else navigation.replaceChildren(link('Masuk','/login','',LogIn),link('Daftar','/register','button primary',UserPlus));
  }
  const unsubscribe=subscribeAuth(render);
  const outside=(event) => { if (open && !root.contains(event.target)) setOpen(false); };
  const keyboard=(event) => { if (event.key==='Escape' && open) { setOpen(false); menuButton.focus(); } };
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',keyboard);
  return { root,destroy() { unsubscribe(); document.removeEventListener('pointerdown',outside); document.removeEventListener('keydown',keyboard); } };
}
