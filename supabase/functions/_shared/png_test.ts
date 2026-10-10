import { png } from '../../../tests/helpers/png.js';
import { validatePng } from './png.ts';

function errorCode(action: () => unknown) {
  try { action(); } catch (error) { return error instanceof Error ? error.message : ''; }
  return '';
}

Deno.test('accepts a bounded transparent PNG',() => {
  const result=validatePng(new Uint8Array(png(120,80,true)));
  if (result.width!==120 || result.height!==80) throw new Error('Unexpected dimensions');
});

Deno.test('returns safe template validation codes',() => {
  if (errorCode(() => validatePng(new TextEncoder().encode('not-png')))!=='TEMPLATE_INVALID') throw new Error('Invalid PNG code mismatch');
  if (errorCode(() => validatePng(new Uint8Array(png(80,80,false))))!=='TEMPLATE_TRANSPARENCY') throw new Error('Transparency code mismatch');
  if (errorCode(() => validatePng(new Uint8Array(3145729)))!=='TEMPLATE_TOO_LARGE') throw new Error('Size code mismatch');
});
