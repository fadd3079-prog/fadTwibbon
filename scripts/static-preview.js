import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname } from 'node:path';

const root=resolve('dist'),config=JSON.parse(await readFile('vercel.json','utf8'));
const types={ '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.txt':'text/plain' };
createServer(async (request,response) => {
  const path=new URL(request.url,'http://localhost').pathname;
  const file=resolve(root,`.${path==='/'?'/index.html':path}`);
  if (!file.startsWith(`${root}/`)) { response.writeHead(403).end(); return; }
  for (const header of config.headers[0].headers) response.setHeader(header.key,header.value);
  try {
    const data=await readFile(file); response.setHeader('Content-Type',types[extname(file)] || 'application/octet-stream'); response.end(data);
  } catch {
    if (extname(path)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type','text/html'); response.end(await readFile(resolve(root,'index.html')));
  }
}).listen(4174,'127.0.0.1',() => console.log('Production build with Vercel security headers: http://127.0.0.1:4174'));
