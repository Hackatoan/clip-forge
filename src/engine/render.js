// Pure canvas-drawing for the timeline. Shared by the live Preview and the
// Exporter so on-screen and rendered output are identical.
import { mediaEngine } from './mediaEngine';
import { sample } from './keyframes';

const TRANSITION_DUR = 0.5; // seconds for in/out transitions

// Per-transition contribution given a progress p (0..1, 0 = fully "out").
function contrib(kind, p) {
  switch (kind) {
    case 'fade':        return { alpha: p, scale: 1, dx: 0, dy: 0 };
    case 'zoom-in':     return { alpha: p, scale: 0.8 + 0.2 * p, dx: 0, dy: 0 };
    case 'zoom-out':    return { alpha: p, scale: 1.2 - 0.2 * p, dx: 0, dy: 0 };
    case 'slide-left':  return { alpha: 1, scale: 1, dx: (1 - p), dy: 0 };
    case 'slide-right': return { alpha: 1, scale: 1, dx: -(1 - p), dy: 0 };
    case 'slide-up':    return { alpha: 1, scale: 1, dx: 0, dy: (1 - p) };
    case 'slide-down':  return { alpha: 1, scale: 1, dx: 0, dy: -(1 - p) };
    default:            return { alpha: 1, scale: 1, dx: 0, dy: 0 };
  }
}

// Combined in + out transition state for a clip at localTime.
function transitionState(clip, localTime) {
  const legacy = clip.transition && clip.transition !== 'none' ? clip.transition : null;
  const tin = clip.transitionIn || legacy || 'none';
  const tout = clip.transitionOut || legacy || 'none';
  let st = { alpha: 1, scale: 1, dx: 0, dy: 0 };
  if (tin !== 'none' && localTime < TRANSITION_DUR) {
    const c = contrib(tin, Math.min(1, localTime / TRANSITION_DUR));
    st = { alpha: st.alpha * c.alpha, scale: st.scale * c.scale, dx: st.dx + c.dx, dy: st.dy + c.dy };
  }
  if (tout !== 'none' && localTime > clip.duration - TRANSITION_DUR) {
    const c = contrib(tout, Math.min(1, (clip.duration - localTime) / TRANSITION_DUR));
    st = { alpha: st.alpha * c.alpha, scale: st.scale * c.scale, dx: st.dx + c.dx, dy: st.dy + c.dy };
  }
  return st;
}

const BLEND = {
  normal: 'source-over', multiply: 'multiply', screen: 'screen',
  overlay: 'overlay', lighten: 'lighten', darken: 'darken', add: 'lighter',
};

// Build a CSS filter string from a clip's colour-adjustment props.
function filterString(clip) {
  const f = [];
  const b = clip.brightness ?? 1, c = clip.contrast ?? 1, s = clip.saturate ?? 1;
  if (b !== 1) f.push(`brightness(${b})`);
  if (c !== 1) f.push(`contrast(${c})`);
  if (s !== 1) f.push(`saturate(${s})`);
  if (clip.blur) f.push(`blur(${clip.blur}px)`);
  if (clip.grayscale) f.push(`grayscale(${clip.grayscale})`);
  if (clip.sepia) f.push(`sepia(${clip.sepia})`);
  if (clip.hue) f.push(`hue-rotate(${clip.hue}deg)`);
  return f.length ? f.join(' ') : 'none';
}

// Draw a video/image element with fit + transform (keyframe-aware).
function drawMedia(ctx, el, W, H, clip, ts, lt) {
  const iw = el.videoWidth || el.naturalWidth || W;
  const ih = el.videoHeight || el.naturalHeight || H;
  const fit = clip.fit || 'cover';
  let dw, dh;
  if (fit === 'fill') {
    dw = W; dh = H;
  } else {
    const arFrame = W / H, arImg = iw / ih;
    if (fit === 'contain') {
      if (arImg > arFrame) { dw = W; dh = W / arImg; } else { dh = H; dw = H * arImg; }
    } else { // cover
      if (arImg > arFrame) { dh = H; dw = H * arImg; } else { dw = W; dh = W / arImg; }
    }
  }
  const scale = sample(clip, 'scale', lt, clip.scale ?? 1) * ts.scale;
  dw *= scale; dh *= scale;
  const cx = sample(clip, 'x', lt, clip.x ?? 0.5) * W + ts.dx * W;
  const cy = sample(clip, 'y', lt, clip.y ?? 0.5) * H + ts.dy * H;
  const rot = (sample(clip, 'rotation', lt, clip.rotation ?? 0) * Math.PI) / 180;

  ctx.filter = filterString(clip);
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);
  try { ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh); } catch { /* frame not ready */ }
  ctx.filter = 'none';
}

// Draw one full frame of the timeline at time `ph` onto ctx (W x H).
export function renderFrame(ctx, W, H, tracks, ph) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (ph < clip.start || ph > clip.start + clip.duration) continue;
      const lt = ph - clip.start;
      const ts = transitionState(clip, lt);

      ctx.save();
      ctx.globalCompositeOperation = BLEND[clip.blend] || 'source-over';
      ctx.globalAlpha = sample(clip, 'opacity', lt, clip.opacity ?? 1) * ts.alpha;

      if (track.type === 'video' && clip.src) {
        const vid = mediaEngine.getVideoElement(clip.id);
        if (vid && vid.readyState >= 2) drawMedia(ctx, vid, W, H, clip, ts, lt);
      } else if (track.type === 'image' && clip.src) {
        const img = mediaEngine.getImageElement(clip.id);
        if (img && img.complete && img.naturalWidth) drawMedia(ctx, img, W, H, clip, ts, lt);
      } else if (track.type === 'text') {
        ctx.font = `${clip.italic ? 'italic ' : ''}${clip.bold ? 'bold ' : ''}${clip.fontSize || 48}px ${clip.fontFamily || 'system-ui, sans-serif'}`;
        ctx.fillStyle = clip.color || '#ffffff';
        ctx.textAlign = clip.align || 'center';
        ctx.textBaseline = 'middle';
        const x = sample(clip, 'x', lt, clip.x ?? 0.5) * W + ts.dx * W;
        const y = sample(clip, 'y', lt, clip.y ?? 0.8) * H + ts.dy * H;
        const rot = (sample(clip, 'rotation', lt, clip.rotation ?? 0) * Math.PI) / 180;
        const sc = sample(clip, 'scale', lt, clip.scale ?? 1) * ts.scale;
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        if (sc !== 1) ctx.scale(sc, sc);
        if (clip.bg) {
          const m = ctx.measureText(clip.text || '');
          const padX = 16, padY = 10;
          const tw = m.width, th = (clip.fontSize || 48);
          let bx = 0;
          if ((clip.align || 'center') === 'center') bx = -tw / 2;
          else if (clip.align === 'right') bx = -tw;
          ctx.save();
          ctx.globalAlpha *= 0.6;
          ctx.fillStyle = clip.bg;
          ctx.fillRect(bx - padX, -th / 2 - padY, tw + padX * 2, th + padY * 2);
          ctx.restore();
          ctx.fillStyle = clip.color || '#ffffff';
        }
        if (clip.stroke) {
          ctx.lineWidth = clip.strokeWidth || 3;
          ctx.strokeStyle = clip.stroke;
          ctx.strokeText(clip.text || '', 0, 0);
        }
        ctx.fillText(clip.text || '', 0, 0);
      } else if (track.type === 'shape') {
        ctx.globalAlpha = sample(clip, 'opacity', lt, clip.opacity ?? 0.8) * ts.alpha;
        ctx.fillStyle = clip.color || '#ff4b3a';
        const cx = sample(clip, 'x', lt, clip.x ?? 0.5) * W + ts.dx * W;
        const cy = sample(clip, 'y', lt, clip.y ?? 0.5) * H + ts.dy * H;
        const w = (clip.w ?? 0.2) * W * ts.scale * sample(clip, 'scale', lt, clip.scale ?? 1);
        const h = (clip.h ?? 0.1) * H * ts.scale * sample(clip, 'scale', lt, clip.scale ?? 1);
        if (clip.shape === 'circle') {
          ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
        } else if (clip.shape === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(cx, cy - h / 2);
          ctx.lineTo(cx + w / 2, cy + h / 2);
          ctx.lineTo(cx - w / 2, cy + h / 2);
          ctx.closePath(); ctx.fill();
        } else {
          ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
        }
      }
      ctx.restore();
    }
  }
}
