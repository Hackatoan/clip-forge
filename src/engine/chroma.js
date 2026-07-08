// Per-clip chroma key (green screen). Processes a source frame into an
// offscreen canvas where pixels near the key colour become transparent, with
// a soft edge for anti-aliasing. Offscreen canvases are cached per clip id.

const cache = new Map(); // clipId -> canvas

function hexToRgb(hex) {
  const n = parseInt((hex || '#00ff00').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Returns a canvas (same aspect as the source) with the key colour removed.
export function chromaProcess(clipId, srcEl, sw, sh, chroma) {
  let c = cache.get(clipId);
  if (!c) { c = document.createElement('canvas'); cache.set(clipId, c); }
  if (c.width !== sw || c.height !== sh) { c.width = sw; c.height = sh; }
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.clearRect(0, 0, sw, sh);
  try { cx.drawImage(srcEl, 0, 0, sw, sh); } catch { return c; }

  const img = cx.getImageData(0, 0, sw, sh);
  const d = img.data;
  const [kr, kg, kb] = hexToRgb(chroma.color);
  const sim = (chroma.similarity ?? 0.4) * 441.67;      // max RGB distance ~441
  const smooth = Math.max(1, (chroma.smoothness ?? 0.1) * 441.67);

  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.sqrt(
      (d[i] - kr) ** 2 + (d[i + 1] - kg) ** 2 + (d[i + 2] - kb) ** 2
    );
    if (dist < sim) {
      d[i + 3] = 0;
    } else if (dist < sim + smooth) {
      d[i + 3] = Math.round(d[i + 3] * (dist - sim) / smooth);
    }
  }
  cx.putImageData(img, 0, 0);
  return c;
}

export function clearChromaCache(clipId) { cache.delete(clipId); }
