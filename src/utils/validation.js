export const LIMITS = Object.freeze({ templateBytes: 3 * 1024 * 1024, photoBytes: 10 * 1024 * 1024, templatePixels: 16_000_000, photoPixels: 40_000_000, side: 4096 });

export function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/g, '');
}

export function validateCampaign({ title, slug, caption = '', description = '' }) {
  if (!title?.trim() || title.trim().length > 120) throw new Error('Judul wajib diisi, maksimal 120 karakter.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 64) throw new Error('Slug harus 3–64 karakter: huruf kecil, angka, dan tanda hubung.');
  if (caption.length > 5000 || description.length > 2000) throw new Error('Deskripsi maksimal 2.000 dan caption maksimal 5.000 karakter.');
}

export function imageKind(bytes) {
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}

export function pngDimensions(bytes) {
  if (imageKind(bytes) !== 'png' || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') throw new Error('Berkas harus berupa PNG yang valid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function validateDimensions(width, height, template = false) {
  const max = template ? LIMITS.templatePixels : LIMITS.photoPixels;
  if (!width || !height || width * height > max || (template && (width > LIMITS.side || height > LIMITS.side))) throw new Error(template ? 'Template maksimal 4.096 piksel per sisi dan 16 megapiksel.' : 'Foto maksimal 40 megapiksel. Pilih foto dengan resolusi lebih kecil.');
}
