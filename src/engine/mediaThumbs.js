// Generates timeline visuals: waveforms for audio clips and poster
// thumbnails for video/image clips. Results are data URLs, cached by source
// so duplicated/split clips don't recompute.

const waveCache = new Map();   // src -> dataURL | Promise<dataURL|null> (Promise = in-flight)
const posterCache = new Map(); // src -> dataURL | Promise<dataURL|null>
let decodeCtx;

export async function ensureWaveform(src) {
  if (waveCache.has(src)) return waveCache.get(src);
  const promise = computeWaveform(src);
  waveCache.set(src, promise);
  const url = await promise;
  if (url) waveCache.set(src, url);
  else waveCache.delete(src); // allow retry on next call
  return url;
}

async function computeWaveform(src) {
  try {
    const buf = await fetch(src).then(r => r.arrayBuffer());
    decodeCtx = decodeCtx || new (window.AudioContext || window.webkitAudioContext)();
    const audio = await decodeCtx.decodeAudioData(buf.slice(0));
    const ch = audio.getChannelData(0);
    const W = 400, H = 48;
    const block = Math.max(1, Math.floor(ch.length / W));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < W; i++) {
      let max = 0;
      const base = i * block;
      for (let j = 0; j < block; j += 4) {
        const v = Math.abs(ch[base + j] || 0);
        if (v > max) max = v;
      }
      const h = Math.max(1, max * H);
      cx.fillRect(i, (H - h) / 2, 1, h);
    }
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function ensurePoster(src, isVideo) {
  if (posterCache.has(src)) return posterCache.get(src);
  const promise = computePoster(src, isVideo);
  posterCache.set(src, promise);
  const url = await promise;
  if (url) posterCache.set(src, url);
  else posterCache.delete(src); // allow retry on next call
  return url;
}

async function computePoster(src, isVideo) {
  try {
    const W = 160, H = 90;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');

    const draw = (el, iw, ih) => {
      // cover fit
      const ar = iw / ih, arF = W / H;
      let dw, dh;
      if (ar > arF) { dh = H; dw = H * ar; } else { dw = W; dh = W / ar; }
      cx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
    };

    if (isVideo) {
      return await new Promise((resolve, reject) => {
        const v = document.createElement('video');
        v.muted = true; v.crossOrigin = 'anonymous'; v.src = src;
        v.onloadeddata = () => { try { v.currentTime = Math.min(0.1, v.duration || 0.1); } catch { resolve(null); } };
        v.onseeked = () => {
          try { draw(v, v.videoWidth, v.videoHeight); resolve(c.toDataURL('image/jpeg', 0.6)); }
          catch { resolve(null); }
        };
        v.onerror = reject;
      });
    } else {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; img.src = src;
        img.onload = () => { draw(img, img.naturalWidth, img.naturalHeight); resolve(c.toDataURL('image/jpeg', 0.6)); };
        img.onerror = reject;
      });
    }
  } catch {
    return null;
  }
}
