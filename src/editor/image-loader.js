import { LIMITS, imageKind, pngDimensions, validateDimensions } from '../utils/validation.js';

function exifOrientation(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i++] !== 255) continue;
    while (i < bytes.length && bytes[i] === 255) i++;
    if (i + 1 >= bytes.length) break;
    const marker = bytes[i++];
    if (marker !== 0xe1) {
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const size = view.getUint16(i);
      if (size < 2 || i + size > bytes.length) break;
      i += size;
      continue;
    }
    const size = view.getUint16(i);
    if (size < 14 || i + size > bytes.length) break;
    if (String.fromCharCode(bytes[i + 2], bytes[i + 3], bytes[i + 4], bytes[i + 5]) !== 'Exif') { i += size; continue; }
    const tiff = i + 8, little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
    if (!little && !(bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d)) break;
    const ifd = tiff + view.getUint32(tiff + 4, little);
    if (ifd + 2 > bytes.length) break;
    const entries = view.getUint16(ifd, little);
    for (let e = 0; e < entries; e++) {
      const entry = ifd + 2 + e * 12;
      if (entry + 12 > bytes.length) break;
      if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
    }
    break;
  }
  return 1;
}

export function sourceDimensions(bytes, kind) {
  if (kind === 'png') return pngDimensions(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (kind === 'jpeg') {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i++] !== 255) continue;
      while (i < bytes.length && bytes[i] === 255) i++;
      if (i + 1 >= bytes.length) break;
      const marker = bytes[i++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const size = view.getUint16(i);
      if (size < 2 || i + size > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        const width = view.getUint16(i + 5), height = view.getUint16(i + 3);
        const orientation = exifOrientation(bytes);
        return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
      }
      i += size;
    }
  }
  if (kind === 'webp') {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === 'VP8X' && bytes.length >= 30) return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  throw new Error('Foto rusak atau format tidak didukung. Gunakan JPEG, PNG, atau WebP.');
}

export async function decode(blob, size) {
  if (typeof createImageBitmap === 'function') {
    const options = { imageOrientation: 'from-image' };
    if (size) Object.assign(options, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' });
    return createImageBitmap(blob, options);
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = url; await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
}

export function release(image) {
  if (image?.close) image.close();
  else if (image instanceof HTMLImageElement) image.src = '';
}

export async function loadPhoto(file, frame) {
  if (!file.size || file.size > LIMITS.photoBytes) throw new Error('Foto maksimal 10 MB. Pilih berkas yang lebih kecil.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) throw new Error('Format tidak didukung. Ubah foto HEIC/HEIF menjadi JPEG, PNG, atau WebP.');
  const dimensions = sourceDimensions(bytes, kind);
  validateDimensions(dimensions.width, dimensions.height);
  const maxSide = Math.min(4096, Math.max(frame.width, frame.height) * 2);
  const ratio = Math.min(1, maxSide / Math.max(dimensions.width, dimensions.height));
  if (!globalThis.createImageBitmap && dimensions.width * dimensions.height > 16_000_000) throw new Error('Foto terlalu besar untuk browser ini. Gunakan foto di bawah 16 megapiksel.');
  try {
    const image = await decode(file, { width: Math.max(1, Math.round(dimensions.width * ratio)), height: Math.max(1, Math.round(dimensions.height * ratio)) });
    validateDimensions(image.width, image.height);
    return image;
  } catch (error) {
    if (error?.friendly) throw error;
    throw new Error('Foto tidak dapat dibaca. Coba berkas JPEG atau PNG lain.');
  }
}

export async function loadTemplate(url, signal) {
  const response = await fetch(url, { mode: 'cors', signal });
  if (!response.ok) throw new Error('Template gagal dimuat. Periksa koneksi, lalu muat ulang.');
  const blob = await response.blob();
  if (blob.size > LIMITS.templateBytes) throw new Error('Template melebihi batas ukuran.');
  return validateTemplate(blob);
}

export async function validateTemplate(file) {
  if (!file.size || file.size > LIMITS.templateBytes) throw new Error('Template PNG maksimal 3 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { width, height } = pngDimensions(bytes);
  validateDimensions(width, height, true);
  const image = await decode(file);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let transparent = 0, visible = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] < 128) transparent++; if (pixels[i] > 0) visible++; }
    if (transparent < width * height * 0.01 || !visible) throw new Error('Template perlu area transparan minimal 1% untuk foto dan bingkai yang terlihat.');
    return image;
  } catch (error) { release(image); throw error; }
  finally { canvas.width = canvas.height = 1; }
}
