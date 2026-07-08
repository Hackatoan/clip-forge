// Generates timeline visuals: waveforms for audio clips and poster
// thumbnails for video/image clips. Results are data URLs, cached by source
// so duplicated/split clips don't recompute.

const waveCache = new Map();   // src -> dataURL | null (null = in-flight)
const posterCache = new Map(); // src -> dataURL | null
let decodeCtx;

export async function ensureWaveform(src) {
  if (waveCache.has(src)) return waveCache.get(src);
  waveCache.set(src, null);
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
    const url = c.toDataURL('image/png');
    waveCache.set(src, url);
    return url;
  } catch {
    waveCache.delete(src);
    return null;
  }
}

export async function ensurePoster(src, isVideo) {
  if (posterCache.has(src)) return posterCache.get(src);
  posterCache.set(src, null);
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
      const url = await new Promise((resolve, reject) => {
        const v = document.createElement('video');
        v.muted = true; v.crossOrigin = 'anonymous'; v.src = src;
        v.onloadeddata = () => { try { v.currentTime = Math.min(0.1, v.duration || 0.1); } catch { resolve(null); } };
        v.onseeked = () => {
          try { draw(v, v.videoWidth, v.videoHeight); resolve(c.toDataURL('image/jpeg', 0.6)); }
          catch { resolve(null); }
        };
        v.onerror = reject;
      });
      posterCache.set(src, url);
      return url;
    } else {
      const url = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; img.src = src;
        img.onload = () => { draw(img, img.naturalWidth, img.naturalHeight); resolve(c.toDataURL('image/jpeg', 0.6)); };
        img.onerror = reject;
      });
      posterCache.set(src, url);
      return url;
    }
  } catch {
    posterCache.delete(src);
    return null;
  }
}
