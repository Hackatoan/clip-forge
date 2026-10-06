// Clip Forge -> Mosaic: the frame under the playhead becomes the target image and stills sampled
// from the timeline's video/image clips become the tiles. OPT-IN: this is the one feature that
// sends pixels off-device (to mosaic.hackatoa.com, processed in memory, not stored unless shared).
import { renderFrame } from './render';

export const MOSAIC_URL = 'https://mosaic.hackatoa.com/api/generate';
const TILE_PX = 192;
const toBlob = (canvas, type = 'image/jpeg', q = 0.88) => new Promise(res => canvas.toBlob(res, type, q));

// Current composited frame at the playhead as a JPEG (Mosaic caps the source at 10 MB).
export async function captureSource(state) {
  const c = document.createElement('canvas');
  c.width = state.canvasW; c.height = state.canvasH;
  renderFrame(c.getContext('2d'), c.width, c.height, state.tracks, state.playhead);
  return toBlob(c, 'image/jpeg', 0.92);
}

function coverDraw(ctx, el, sw, sh) {
  const s = Math.max(TILE_PX / sw, TILE_PX / sh), w = sw * s, h = sh * s;
  ctx.drawImage(el, (TILE_PX - w) / 2, (TILE_PX - h) / 2, w, h);
}

const loadVideo = (src) => new Promise((resolve, reject) => {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.onloadedmetadata = () => resolve(v);
  v.onerror = () => reject(new Error('could not read a video clip'));
  v.src = src;
});
const seek = (v, t) => new Promise(resolve => {
  const done = () => { v.removeEventListener('seeked', done); clearTimeout(to); resolve(); };
  const to = setTimeout(done, 4000);
  v.addEventListener('seeked', done); v.currentTime = t;
});
const loadImage = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('could not read an image clip')); i.src = src; });

// Sample up to `count` square JPEG stills spread across the timeline. Images give one tile each;
// videos share the remaining budget in proportion to their length. onProgress(done, total).
export async function sampleStills(tracks, count, onProgress = () => {}) {
  const clips = [];
  for (const t of tracks) for (const c of t.clips) if (c.src && (t.type === 'video' || t.type === 'image')) clips.push({ ...c, kind: t.type });
  const images = clips.filter(c => c.kind === 'image'), videos = clips.filter(c => c.kind === 'video');
  const vidTotal = videos.reduce((a, c) => a + Math.max(c.duration, 0.1), 0);
  const budget = Math.max(count - images.length, videos.length ? 3 : 0);
  const plan = [
    ...images.map(c => ({ clip: c, n: 1 })),
    ...videos.map(c => ({ clip: c, n: Math.max(1, Math.round(budget * Math.max(c.duration, 0.1) / vidTotal)) })),
  ];
  const total = Math.min(count, plan.reduce((a, p) => a + p.n, 0));
  if (total < 3) throw new Error('Add at least one video clip (or three images) to the timeline first.');

  const out = [], canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  for (const { clip, n } of plan) {
    if (out.length >= total) break;
    if (clip.kind === 'image') {
      const img = await loadImage(clip.src);
      ctx.clearRect(0, 0, TILE_PX, TILE_PX); coverDraw(ctx, img, img.naturalWidth, img.naturalHeight);
      out.push(await toBlob(canvas)); onProgress(out.length, total); continue;
    }
    const v = await loadVideo(clip.src), speed = clip.speed || 1, last = Math.max(0, (v.duration || 1) - 0.05);
    for (let i = 0; i < n && out.length < total; i++) {
      await seek(v, Math.min(last, (clip.offset || 0) + clip.duration * (i + 0.5) / n * speed));
      ctx.clearRect(0, 0, TILE_PX, TILE_PX); coverDraw(ctx, v, v.videoWidth, v.videoHeight);
      out.push(await toBlob(canvas)); onProgress(out.length, total);
    }
    v.removeAttribute('src'); v.load();
  }
  return out;
}

export async function makeMosaic({ source, tiles, cols = 50, tileSize = 24 }) {
  const fd = new FormData();
  fd.append('source', source, 'frame.jpg');
  fd.append('cols', String(cols)); fd.append('tileSize', String(tileSize));
  tiles.forEach((b, i) => fd.append('tiles', b, `tile-${i}.jpg`));
  const res = await fetch(MOSAIC_URL, { method: 'POST', body: fd, signal: AbortSignal.timeout(120000) });
  if (res.status === 429) throw new Error('Mosaic is rate-limited (12 per 10 minutes). Try again in a bit.');
  if (!res.ok) { let m = ''; try { m = (await res.json()).error; } catch { /* non-JSON error body */ } throw new Error(m || `Mosaic failed (${res.status})`); }
  return res.blob();
}
