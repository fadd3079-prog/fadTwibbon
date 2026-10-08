import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/editor/renderer.js';
import { recordDownload } from '../../src/services/analytics.js';

test('compositing restores photo transform before the fixed template layer',() => {
  const calls=[],ctx=new Proxy({}, { get:(_,name) => (...args) => calls.push([name,...args]) });
  const template={ width:1080,height:720 },photo={ width:1600,height:900 };
  render(ctx,template,template,photo,{ x:200,y:300,scale:2,rotation:Math.PI/2 },540,360);
  assert.deepEqual(calls.filter(([name]) => name==='drawImage'),[['drawImage',photo,-800,-450],['drawImage',template,0,0,1080,720]]);
  assert.equal(calls.findIndex(([name]) => name==='rotate')<calls.findIndex(([name]) => name==='drawImage'),true);
  const lastPhoto=calls.findIndex(([name,args]) => name==='drawImage' && args===photo);
  assert.equal(calls[lastPhoto+1][0],'restore');
  assert.deepEqual(calls[0],['setTransform',1,0,0,1,0,0]);
});
test('analytics errors are isolated and payload contains metadata only',async () => {
  const original=globalThis.fetch; let payload;
  globalThis.fetch=async (_,options) => { payload=JSON.parse(options.body); throw new TypeError('offline'); };
  try { assert.equal(await recordDownload('campaign','event'),null); assert.deepEqual(payload,{ campaignId:'campaign',eventToken:'event' }); }
  finally { globalThis.fetch=original; }
});
