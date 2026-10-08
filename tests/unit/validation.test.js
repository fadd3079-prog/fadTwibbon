import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageKind,pngDimensions,validateDimensions,slugify,validateCampaign } from '../../src/utils/validation.js';
import { png } from '../helpers/png.js';

test('PNG signature and original dimensions',() => { const data=png(1080,720,true); assert.equal(imageKind(data),'png'); assert.deepEqual(pngDimensions(data),{ width:1080,height:720 }); });
test('extensions are not accepted as evidence of an image',() => { assert.equal(imageKind(Buffer.from('<svg></svg>')),null); assert.throws(() => pngDimensions(Buffer.from('fake.png'))); });
test('image limits reject oversized and empty images',() => { assert.throws(() => validateDimensions(0,1080,true)); assert.throws(() => validateDimensions(4097,1080,true)); assert.throws(() => validateDimensions(4096,4096,true)); assert.throws(() => validateDimensions(10000,5000)); validateDimensions(1080,1080,true); });
test('slug generation and input constraints',() => { assert.equal(slugify('  Hari Pendidikan! 2026  '),'hari-pendidikan-2026'); assert.equal(slugify('École'),'ecole'); validateCampaign({ title:'Hari Pendidikan',slug:'hari-pendidikan' }); for (const slug of ['Aaa','ab','a/b','a--b','-aaa','a'.repeat(65)]) assert.throws(() => validateCampaign({ title:'test',slug })); assert.throws(() => validateCampaign({ title:' ',slug:'valid' })); assert.throws(() => validateCampaign({ title:'Valid',slug:'valid',caption:'x'.repeat(5001) })); });
