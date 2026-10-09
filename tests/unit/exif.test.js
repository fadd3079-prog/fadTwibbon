import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceDimensions } from '../../src/editor/image-loader.js';

function jpegWithExif(orientation, width, height) {
  const exif = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // TIFF LE header
    0x01, 0x00, // 1 IFD entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
    orientation & 0xff, (orientation >> 8) & 0xff, 0x00, 0x00, // orientation value
    0x00, 0x00, 0x00, 0x00, // next IFD offset
  ];
  const app1Len = exif.length + 2;
  const sof = [0xff, 0xc0, 0x00, 0x0b, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 0x01, 0x11, 0x00];
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...exif, ...sof, 0xff, 0xda]);
  return bytes;
}

test('portrait photo with EXIF orientation 6 reports swapped dimensions', () => {
  const dims = sourceDimensions(jpegWithExif(6, 3000, 4000), 'jpeg');
  assert.deepEqual(dims, { width: 4000, height: 3000 });
});

test('photo with EXIF orientation 1 keeps dimensions', () => {
  const dims = sourceDimensions(jpegWithExif(1, 3000, 4000), 'jpeg');
  assert.deepEqual(dims, { width: 3000, height: 4000 });
});

test('photo without EXIF keeps dimensions', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x0f, 0xa0, 0x0b, 0xb8, 0x01, 0x11, 0x00, 0xff, 0xda]);
  const dims = sourceDimensions(bytes, 'jpeg');
  assert.deepEqual(dims, { width: 3000, height: 4000 });
});

test('corrupt JPEG throws friendly error instead of RangeError', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xff, 0xff]);
  assert.throws(() => sourceDimensions(bytes, 'jpeg'), /Foto rusak atau format tidak didukung/);
});

test('short EXIF segment is ignored without out-of-bounds reads',() => {
  const bytes=new Uint8Array([0xff,0xd8,0xff,0xe1,0,14,0x45,0x78,0x69,0x66,0,0,0x49,0x49,0x2a,0,0,0,0xff,0xc0,0,0x0b,8,0,40,0,80,1,0x11,0,0xff,0xda]);
  assert.deepEqual(sourceDimensions(bytes,'jpeg'),{ width:80,height:40 });
});
