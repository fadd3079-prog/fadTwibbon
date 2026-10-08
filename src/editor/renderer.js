export function render(ctx, frame, template, photo, state, width, height) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, width, height);
  ctx.save(); ctx.scale(width / frame.width, height / frame.height);
  if (photo && state) {
    ctx.save(); ctx.translate(state.x, state.y); ctx.rotate(state.rotation); ctx.scale(state.scale, state.scale);
    ctx.drawImage(photo, -photo.width / 2, -photo.height / 2); ctx.restore();
  }
  ctx.drawImage(template, 0, 0, frame.width, frame.height); ctx.restore();
}

export async function exportPng(frame, template, photo, state) {
  if (!photo) throw new Error('Pilih foto terlebih dahulu.');
  const canvas = document.createElement('canvas'); canvas.width = frame.width; canvas.height = frame.height;
  try {
    render(canvas.getContext('2d'), frame, template, photo, state, frame.width, frame.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG gagal dibuat. Coba foto yang lebih kecil.')), 'image/png'));
  } finally { canvas.width = canvas.height = 1; }
}
