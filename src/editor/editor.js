import { el, button, status, message, copy } from '../utils/ui.js';
import { loadPhoto, release } from './image-loader.js';
import { initialTransform, constrain, coverScale, transformAt, pointerToFrame } from './geometry.js';
import { render, exportPng } from './renderer.js';
import { Copy,Download,RefreshCcw,RotateCcw,RotateCw,Upload,ZoomIn,ZoomOut } from 'lucide';

export function createEditor(template, { slug = 'preview', caption = '', onDownload, preview = false } = {}) {
  const frame = { width: template.width, height: template.height };
  const canvas = el('canvas', { tabindex: '0', role: 'img', 'aria-label': 'Editor foto. Gunakan tombol panah untuk geser, tambah dan kurang untuk zoom, serta kurung siku untuk putar.', 'aria-describedby': 'editor-help' });
  canvas.style.aspectRatio = `${frame.width} / ${frame.height}`;
  const feedback = status();
  const input = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, id: 'photo-file', tabindex: '-1' });
  const select = button('Pilih Foto', () => input.click(), 'choose primary',Upload);
  const download = button('Unduh Twibbon', async () => {
    download.disabled = true; message(feedback, 'Membuat PNG…');
    try {
      const blob = await exportPng(frame, template, photo, state);
      if (disposed) return;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      const a = el('a', { href: downloadUrl, download: `fadTwibbon-${slug}.png` });
      document.body.append(a); a.click(); a.remove();
      save.href = downloadUrl; save.hidden = false;
      message(feedback, 'PNG siap. Jika unduhan tidak muncul, buka hasil lalu simpan melalui menu browser.');
      if (onDownload) Promise.resolve().then(onDownload).catch(() => { });
    } catch (error) { message(feedback, error.message || 'Ekspor gagal. Coba foto lain.', true); }
    finally { download.disabled = !photo; }
  }, 'primary',Download);
  const save = el('a', { hidden: true, target: '_blank', rel: 'noopener', class: 'save-result' }, 'Buka hasil PNG');
  let photo = null, state = null, raf = 0, disposed = false, photoSequence = 0, downloadUrl = null;
  const pointers = new Map(); let gesture;
  const controls = el('fieldset', { disabled: true, class: 'editor-controls' }, el('legend', { class: 'control-label' }, 'Sesuaikan foto'));
  const center = { x: frame.width / 2, y: frame.height / 2 };
  const change = (next) => { if (!photo) return; state = constrain(next, frame, photo); requestRender(); };
  const zoom = (factor) => { if (state) change(transformAt(state, center, center, state.scale * factor, state.rotation)); };
  const rotate = (angle) => { if (state) change({ ...state, rotation: state.rotation + angle }); };
  controls.append(button('Perkecil', () => zoom(1 / 1.12),'tool-button',ZoomOut), button('Perbesar', () => zoom(1.12),'tool-button',ZoomIn), button('Putar Kiri', () => rotate(-Math.PI / 12),'tool-button',RotateCcw), button('Putar Kanan', () => rotate(Math.PI / 12),'tool-button',RotateCw), button('Atur Ulang', () => { if (photo) change(initialTransform(frame, photo)); },'tool-button reset-tool',RefreshCcw));
  const slider = el('input', { type: 'range', min: '100', max: '500', value: '100', step: '1', 'aria-label': 'Perbesaran foto' });
  slider.addEventListener('input', () => { if (state) change(transformAt(state, center, center, coverScale(frame, photo, state.rotation) * Number(slider.value) / 100, state.rotation)); });
  controls.append(el('label', { class: 'zoom-label' }, 'Zoom', slider));
  const help = el('p', { id: 'editor-help', class: 'editor-help' }, 'Geser atau cubit foto.');
  const tools=el('div',{ class:'editor-tools' },input,select,controls,help);
  const root = el('section', { class: preview ? 'editor editor-preview' : 'editor', 'aria-label': preview ? 'Pratinjau template' : 'Buat Twibbon' }, el('div', { class: 'canvas-wrap' }, canvas), tools);
  if (!preview) tools.append(el('div',{ class:'editor-actions' },download,save,button('Salin Caption', () => copy(caption, feedback), 'caption-button',Copy)));
  tools.append(feedback, el('p', { class: 'privacy-note' }, 'Foto tetap di perangkat Anda.'));

  function requestRender() {
    if (disposed || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      render(canvas.getContext('2d'), frame, template, photo, state, width, height);
      if (state) slider.value = String(Math.round(state.scale / coverScale(frame, photo, state.rotation) * 100));
    });
  }

  input.addEventListener('change', async () => {
    const file = input.files[0]; input.value = ''; if (!file) return;
    const seq = ++photoSequence; select.disabled = true; message(feedback, 'Membaca foto…');
    try {
      const next = await loadPhoto(file, frame);
      if (disposed || seq !== photoSequence) { release(next); return; }
      release(photo); photo = next; state = initialTransform(frame, photo);
      controls.disabled = false; download.disabled = false; select.querySelector('span').textContent = 'Ganti Foto'; select.classList.remove('primary');
      if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; save.hidden = true; }
      message(feedback, 'Foto siap. Sesuaikan posisi sebelum mengunduh.'); requestRender();
    } catch (error) { message(feedback, error.message, true); }
    finally { select.disabled = false; }
  });

  function startGesture() {
    const points = [...pointers.values()];
    if (!state || !points.length) { gesture = null; return; }
    const [a, b] = points;
    gesture = { state: { ...state }, center: b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a, distance: b ? Math.hypot(b.x - a.x, b.y - a.y) : 0, angle: b ? Math.atan2(b.y - a.y, b.x - a.x) : 0 };
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (!photo || pointers.size >= 2) return;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer already released; gesture continues without capture */ }
    pointers.set(event.pointerId, pointerToFrame(event, canvas.getBoundingClientRect(), frame)); startGesture();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, pointerToFrame(event, canvas.getBoundingClientRect(), frame));
    const [a, b] = [...pointers.values()];
    const target = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
    const scale = b && gesture.distance > 0 ? gesture.state.scale * Math.hypot(b.x - a.x, b.y - a.y) / gesture.distance : gesture.state.scale;
    const rotation = b ? gesture.state.rotation + Math.atan2(b.y - a.y, b.x - a.x) - gesture.angle : gesture.state.rotation;
    change(transformAt(gesture.state, gesture.center, target, scale, rotation));
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, (event) => { pointers.delete(event.pointerId); startGesture(); });
  canvas.addEventListener('keydown', (event) => {
    if (!photo) return;
    const step = Math.max(frame.width, frame.height) / (event.shiftKey ? 20 : 100);
    const actions = { ArrowLeft: () => change({ ...state, x: state.x - step }), ArrowRight: () => change({ ...state, x: state.x + step }), ArrowUp: () => change({ ...state, y: state.y - step }), ArrowDown: () => change({ ...state, y: state.y + step }), '+': () => zoom(1.12), '=': () => zoom(1.12), '-': () => zoom(1 / 1.12), '[': () => rotate(-Math.PI / 12), ']': () => rotate(Math.PI / 12) };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });
  download.disabled = true;
  const observer = new ResizeObserver(requestRender); observer.observe(canvas); requestRender();
  return { root, destroy() { disposed = true; photoSequence++; observer.disconnect(); cancelAnimationFrame(raf); release(photo); release(template); if (downloadUrl) URL.revokeObjectURL(downloadUrl); canvas.width = canvas.height = 1; } };
}
