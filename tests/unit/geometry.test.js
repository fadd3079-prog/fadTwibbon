import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverScale,initialTransform,constrain,transformAt,pointerToFrame } from '../../src/editor/geometry.js';

const frame={ width:1080,height:1080 },photo={ width:1600,height:900 };
test('cover-fit portrait, landscape and rectangular frames',() => {
  assert.equal(coverScale(frame,photo),1.2);
  assert.equal(coverScale(frame,{ width:900,height:1600 }),1.2);
  assert.equal(coverScale({ width:600,height:900 },{ width:600,height:900 }),1);
  assert.deepEqual(initialTransform(frame,photo),{ x:540,y:540,scale:1.2,rotation:0 });
});
test('pointer mapping uses template coordinates, not preview pixels',() => {
  assert.deepEqual(pointerToFrame({ clientX:120,clientY:70 },{ left:20,top:20,width:200,height:100 },frame),{ x:540,y:540 });
});
test('pinch preserves the image coordinate under the anchor',() => {
  const state={ x:430,y:520,scale:2,rotation:.5 },anchor={ x:600,y:500 },target={ x:620,y:550 };
  const next=transformAt(state,anchor,target,3,1);
  const local=(s,p) => ({ x:((p.x-s.x)*Math.cos(s.rotation)+(p.y-s.y)*Math.sin(s.rotation))/s.scale,y:(-(p.x-s.x)*Math.sin(s.rotation)+(p.y-s.y)*Math.cos(s.rotation))/s.scale });
  const a=local(state,anchor),b=local(next,target);
  assert.ok(Math.abs(a.x-b.x)<1e-9); assert.ok(Math.abs(a.y-b.y)<1e-9);
});
test('rotated photos always cover every frame corner, including extreme drags',() => {
  for (let i=0;i<360;i+=5) {
    const rotation=i*Math.PI/180,next=constrain({ x:1e6,y:-1e6,scale:.1,rotation },frame,photo);
    for (const [x,y] of [[0,0],[1080,0],[0,1080],[1080,1080]]) {
      const dx=x-next.x,dy=y-next.y;
      assert.ok(Math.abs((dx*Math.cos(rotation)+dy*Math.sin(rotation))/next.scale)<=photo.width/2+1e-6);
      assert.ok(Math.abs((-dx*Math.sin(rotation)+dy*Math.cos(rotation))/next.scale)<=photo.height/2+1e-6);
    }
  }
});
test('zoom is bounded to five times rotation-adjusted minimum',() => {
  assert.equal(constrain({ x:540,y:540,scale:100,rotation:0 },frame,photo).scale,6);
});
