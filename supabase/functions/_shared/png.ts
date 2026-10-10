import { Buffer } from 'node:buffer';
// @ts-types="npm:@types/pngjs@6.0.5"
import { PNG } from 'npm:pngjs@7.0.0';

export function validatePng(data: Uint8Array) {
  if (data.length > 3145728) throw new Error('TEMPLATE_TOO_LARGE');
  if (data.length < 33 || ![137,80,78,71,13,10,26,10].every((v,i) => data[i]===v)) throw new Error('TEMPLATE_INVALID');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(8)!==13 || String.fromCharCode(...data.slice(12,16))!=='IHDR') throw new Error('TEMPLATE_INVALID');
  const width = view.getUint32(16), height = view.getUint32(20);
  // pngjs bounds non-interlaced inflate output; its interlaced path does not.
  if (!width || !height || width>4096 || height>4096 || width*height>16000000) throw new Error('TEMPLATE_DIMENSIONS');
  if (data[24]!==8 || data[28]!==0) throw new Error('TEMPLATE_ENCODING');
  let i = 8, compressed = 0, foundEnd = false;
  while (i + 12 <= data.length) {
    const length = view.getUint32(i), type = String.fromCharCode(...data.slice(i+4,i+8));
    if (i+12+length>data.length) throw new Error('TEMPLATE_INVALID');
    if (type === 'acTL') throw new Error('TEMPLATE_ENCODING');
    if (type === 'IDAT') compressed += length;
    if (type === 'IEND') { foundEnd = true; if (i+12+length!==data.length) throw new Error('TEMPLATE_INVALID'); break; }
    i += 12+length;
  }
  if (!foundEnd || !compressed) throw new Error('TEMPLATE_INVALID');
  let png;
  try { png = PNG.sync.read(Buffer.from(data), { checkCRC: true, skipRescale: false }); } catch { throw new Error('TEMPLATE_INVALID'); }
  let transparent = 0, visible = 0;
  for (let p=3;p<png.data.length;p+=4) { if (png.data[p]<128) transparent++; if (png.data[p]>0) visible++; }
  if (transparent<width*height*0.01 || !visible) throw new Error('TEMPLATE_TRANSPARENCY');
  return { width, height };
}
