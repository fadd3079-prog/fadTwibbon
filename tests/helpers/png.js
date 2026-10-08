import { deflateSync } from 'node:zlib';

function crc32(data) {
  let crc=0xffffffff;
  for (const byte of data) { crc^=byte; for (let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data) {
  const bytes=Buffer.concat([Buffer.from(type),data]),header=Buffer.alloc(4),crc=Buffer.alloc(4);
  header.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(bytes));
  return Buffer.concat([header,bytes,crc]);
}
export function png(width=1080,height=1080,frame=false) {
  const header=Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height,4); header[8]=8; header[9]=6;
  const rows=Buffer.alloc((width*4+1)*height);
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) { const i=y*(width*4+1)+1+x*4; rows[i]=frame?245:210; rows[i+1]=frame?200:40; rows[i+2]=frame?30:70; rows[i+3]=frame && x>30 && y>30 && x<width-31 && y<height-31?0:255; }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
