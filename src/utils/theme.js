import { el } from './ui.js';

const key='fadtwibbon-theme';
const system=matchMedia('(prefers-color-scheme: dark)');
let preference='system';
try { const saved=localStorage.getItem(key); if (['light','dark','system'].includes(saved)) preference=saved; } catch { /* Theme still works when browser storage is unavailable. */ }
function apply() {
  const theme=preference==='system'?(system.matches?'dark':'light'):preference;
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#121212':'#f5f4ef');
}
apply(); system.addEventListener('change',() => { if (preference==='system') apply(); });

export function themeControl() {
  const select=el('select',{ 'aria-label':'Tema tampilan',class:'theme-select' },el('option',{ value:'system' },'Tema sistem'),el('option',{ value:'light' },'Terang'),el('option',{ value:'dark' },'Gelap'));
  select.value=preference;
  select.addEventListener('change',() => { preference=select.value; try { localStorage.setItem(key,preference); } catch { /* No persistence in restricted browser contexts. */ } apply(); });
  return select;
}
