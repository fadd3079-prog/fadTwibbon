import test from 'node:test';
import assert from 'node:assert/strict';
import { errorText } from '../../src/utils/ui.js';

test('campaign workflow error codes have specific safe messages',() => {
  assert.equal(errorText(new Error('MISSING_TEMPLATE')),'Tambahkan template PNG sebelum menerbitkan.');
  assert.equal(errorText(new Error('TEMPLATE_TRANSPARENCY')),'Template perlu area transparan minimal 1% dan bingkai yang terlihat.');
  assert.equal(errorText(new Error('CONFLICT')),'Data berubah di sesi lain. Muat ulang sebelum menyimpan kembali.');
  assert.equal(errorText(new Error('database host detail')),'Tindakan gagal. Periksa isian atau coba lagi beberapa saat lagi.');
});
