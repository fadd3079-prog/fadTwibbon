import { Moon,Sun } from 'lucide';
import { icon } from '../components/icon.js';
import { el } from './ui.js';

const key='fadtwibbon-theme';
const system=matchMedia('(prefers-color-scheme: dark)');
let preference=null;
try { const saved=localStorage.getItem(key); if (saved==='light' || saved==='dark') preference=saved; } catch { /* Storage is optional. */ }
const current=() => preference || (system.matches?'dark':'light');
const controls=new Set();

function apply() {
  const theme=current();
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#383838':'#eeeeee');
  for (const control of controls) {
    const dark=theme==='dark';
    control.replaceChildren(icon(dark?Sun:Moon));
    control.setAttribute('aria-label',dark?'Gunakan Tema Terang':'Gunakan Tema Gelap');
    control.title=dark?'Tema Terang':'Tema Gelap';
  }
}

apply();
system.addEventListener('change',() => { if (!preference) apply(); });

export function themeControl() {
  const control=el('button',{ type:'button',class:'icon-button theme-toggle' });
  controls.add(control); apply();
  control.addEventListener('click',() => {
    preference=current()==='dark'?'light':'dark';
    try { localStorage.setItem(key,preference); } catch { /* Theme still changes for this page. */ }
    apply();
  });
  return control;
}
