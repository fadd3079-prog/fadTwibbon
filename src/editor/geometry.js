export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function coverScale(frame, photo, rotation = 0) {
  const c = Math.abs(Math.cos(rotation));
  const s = Math.abs(Math.sin(rotation));
  return Math.max((frame.width * c + frame.height * s) / photo.width, (frame.width * s + frame.height * c) / photo.height);
}

export function initialTransform(frame, photo) {
  return { x: frame.width / 2, y: frame.height / 2, scale: coverScale(frame, photo), rotation: 0 };
}

export function constrain(state, frame, photo) {
  const min = coverScale(frame, photo, state.rotation);
  const scale = clamp(state.scale, min, min * 5);
  const c = Math.cos(state.rotation), s = Math.sin(state.rotation);
  const dx = state.x - frame.width / 2, dy = state.y - frame.height / 2;
  const localX = dx * c + dy * s, localY = -dx * s + dy * c;
  const extentX = (frame.width * Math.abs(c) + frame.height * Math.abs(s)) / 2;
  const extentY = (frame.width * Math.abs(s) + frame.height * Math.abs(c)) / 2;
  const x = clamp(localX, extentX - photo.width * scale / 2, photo.width * scale / 2 - extentX);
  const y = clamp(localY, extentY - photo.height * scale / 2, photo.height * scale / 2 - extentY);
  return { ...state, scale, x: frame.width / 2 + x * c - y * s, y: frame.height / 2 + x * s + y * c };
}

export function transformAt(state, anchor, target, scale, rotation) {
  const dx = (anchor.x - state.x) / state.scale, dy = (anchor.y - state.y) / state.scale;
  const c0 = Math.cos(state.rotation), s0 = Math.sin(state.rotation);
  const lx = dx * c0 + dy * s0, ly = -dx * s0 + dy * c0;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return { x: target.x - scale * (lx * c - ly * s), y: target.y - scale * (lx * s + ly * c), scale, rotation };
}

export function pointerToFrame(event, rect, frame) {
  return { x: (event.clientX - rect.left) * frame.width / rect.width, y: (event.clientY - rect.top) * frame.height / rect.height };
}
