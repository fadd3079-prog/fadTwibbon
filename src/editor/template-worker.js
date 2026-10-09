// Web Worker: count transparent/visible pixels off the main thread.
// Receives { pixels: Uint8ClampedArray, width, height }, transfers buffer for zero-copy.
self.onmessage = (event) => {
  const { pixels, width, height } = event.data;
  let transparent = 0, visible = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    const a = pixels[i];
    if (a < 128) transparent++;
    if (a > 0) visible++;
  }
  self.postMessage({ transparent, visible, total: width * height });
};
