export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (value != null && value !== false) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

export const link = (text, href, className = '') => el('a', { href, class: className }, text);
export const button = (text, handler, className = '') => el('button', { type: 'button', class: className, onclick: handler }, text);
export const status = () => el('p', { class: 'notice', role: 'status', 'aria-live': 'polite' });
export function message(node, text, error = false) {
  node.textContent = text;
  node.classList.toggle('error', error);
}

export function errorText(error) {
  const raw = error?.message || '';
  const known = {
    FORBIDDEN: 'Anda tidak memiliki izin atau akun sedang ditangguhkan.',
    UNAUTHORIZED: 'Sesi berakhir. Silakan masuk kembali dan verifikasi email Anda.',
    APPROVAL_REQUIRED: 'Publikasi menunggu persetujuan pengelola platform.',
    CONFLICT: 'Data berubah di sesi lain. Muat ulang sebelum menyimpan kembali.',
    SLUG_LOCKED: 'Slug tidak dapat diubah setelah kampanye pernah dipublikasikan.',
    QUOTA_EXCEEDED: 'Kuota kampanye atau penyimpanan Anda sudah penuh.',
    VALIDATION_ERROR: 'Periksa kembali isian dan template kampanye.',
    NOT_FOUND: 'Kampanye tidak tersedia.',
    'Invalid login credentials': 'Email atau kata sandi tidak cocok.',
    'Email not confirmed': 'Verifikasi email Anda sebelum masuk.',
  };
  for (const [key, value] of Object.entries(known)) if (raw.includes(key)) return value;
  if (error?.code === '23505' || raw.includes('duplicate key')) return 'Slug sudah digunakan. Pilih slug lain.';
  if (error instanceof TypeError || raw.includes('fetch')) return 'Koneksi gagal. Periksa jaringan Anda, lalu coba lagi.';
  return error?.friendly ? raw : 'Tindakan gagal. Periksa isian atau coba lagi beberapa saat lagi.';
}

export async function busy(control, feedback, action, success = '') {
  control.disabled = true;
  message(feedback, 'Memproses…');
  try { const result = await action(); if (success || feedback.textContent === 'Memproses…') message(feedback, success); return result; }
  catch (error) { message(feedback, errorText(error), true); }
  finally { control.disabled = false; }
}

export function field(label, name, options = {}) {
  const { multiline, help, ...attrs } = options;
  const input = el(multiline ? 'textarea' : 'input', { id: name, name, ...attrs });
  const wrap = el('div', { class: 'field' }, el('label', { for: name }, label), input);
  if (help) { wrap.append(el('small', { id: `${name}-help` }, help)); input.setAttribute('aria-describedby', `${name}-help`); }
  return { wrap, input };
}

export async function copy(text, feedback) {
  try { await navigator.clipboard.writeText(text); message(feedback, 'Disalin.'); }
  catch {
    const area = el('textarea', { readonly: true, 'aria-label': 'Teks untuk disalin', class: 'copy-fallback' });
    area.value = text;
    feedback.replaceChildren('Pilih teks berikut, lalu salin secara manual.', area);
    area.focus(); area.select();
  }
}

export function confirmAction(title, text, actionLabel, action) {
  const feedback = status();
  const dialog = el('dialog', {}, el('h2', {}, title), el('p', {}, text), feedback);
  const cancel = button('Batal', () => dialog.close());
  const proceed = button(actionLabel, () => busy(proceed, feedback, async () => { await action(); dialog.close(); }), 'danger');
  dialog.append(el('div', { class: 'actions' }, cancel, proceed));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog); dialog.showModal(); cancel.focus();
}

export const number = (value) => new Intl.NumberFormat('id-ID').format(value || 0);
export const date = (value) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
