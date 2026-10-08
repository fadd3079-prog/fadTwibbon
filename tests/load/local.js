import { performance } from 'node:perf_hooks';

const origin=process.env.LOAD_URL || 'http://127.0.0.1:3000';
if (!['127.0.0.1','localhost'].includes(new URL(origin).hostname)) throw new Error('Tes ini hanya boleh dijalankan pada localhost.');
for (const count of [25,50,100,250,500]) {
  const start=performance.now(),times=[]; let errors=0,totalBytes=0;
  await Promise.all(Array.from({ length:count },async () => { const t=performance.now(); try { const response=await fetch(origin,{ signal:AbortSignal.timeout(10000) }); if (!response.ok) errors++; totalBytes+=(await response.arrayBuffer()).byteLength; } catch { errors++; } times.push(performance.now()-t); }));
  times.sort((a,b) => a-b);
  console.log(JSON.stringify({ visitors:count,errors,p50_ms:Math.round(times[Math.floor(count*.5)]),p95_ms:Math.round(times[Math.floor(count*.95)]),bytes:totalBytes,duration_ms:Math.round(performance.now()-start) }));
  if (errors) process.exitCode=1;
}
