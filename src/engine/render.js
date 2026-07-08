// Pure canvas-drawing for the timeline. Shared by the live Preview and the
// Exporter so on-screen and rendered output are identical.
import { mediaEngine } from './mediaEngine';

const TRANSITION_DUR = 0.5; // seconds for in/out transitions

// Returns { alpha, scale, dx } for a clip at localTime (time since clip start).
function transitionState(clip, localTime) {
  const t = clip.transition || 'none';
  if (t === 'none') return { alpha: 1, scale: 1, dx: 0, dy: 0 };
  const dur = clip.duration;
  const inP = Math.min(1, localTime / TRANSITION_DUR);           // 0->1 at start
  const outP = Math.min(1, (dur - localTime) / TRANSITION_DUR);  // 1->0 at end
  const p = Math.min(inP, outP); // symmetric in/out
  switch (t) {
    case 'fade':        return { alpha: p, scale: 1, dx: 0, dy: 0 };
    case 'zoom-in':     return { alpha: inP, scale: 0.8 + 0.2 * inP, dx: 0, dy: 0 };
    case 'zoom-out':    return { alpha: inP, scale: 1.2 - 0.2 * inP, dx: 0, dy: 0 };
    case 'slide-left':  return { alpha: 1, scale: 1, dx: (1 - inP), dy: 0 };
    case 'slide-right': return { alpha: 1, scale: 1, dx: -(1 - inP), dy: 0 };
    case 'wipe':        return { alpha: inP, scale: 1, dx: 0, dy: 0 };
    default:            return { alpha: 1, scale: 1, dx: 0, dy: 0 };
  }
}

// Draw one full frame of the timeline at time `ph` onto ctx (W x H).
export function renderFrame(ctx, W, H, tracks, ph) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Draw bottom-up so later tracks render on top.
  for (const track of tracks) {
    if (track.muted && track.type !== 'video') { /* muted audio still silent */ }
    for (const clip of track.clips) {
      if (ph < clip.start || ph > clip.start + clip.duration) continue;
      const localTime = ph - clip.start;
      const ts = transitionState(clip, localTime);

      ctx.save();
      ctx.globalAlpha = (clip.opacity ?? 1) * ts.alpha;

      if (track.type === 'video' && clip.src) {
        const vid = mediaEngine.getVideoElement(clip.id);
        if (vid && vid.readyState >= 2) {
          const sw = W * ts.scale, sh = H * ts.scale;
          const ox = (W - sw) / 2 + ts.dx * W;
          const oy = (H - sh) / 2 + ts.dy * H;
          try { ctx.drawImage(vid, ox, oy, sw, sh); } catch { /* frame not ready */ }
        }
      } else if (track.type === 'text') {
        ctx.font = `${clip.bold ? 'bold ' : ''}${clip.fontSize || 48}px ${clip.fontFamily || 'system-ui, sans-serif'}`;
        ctx.fillStyle = clip.color || '#ffffff';
        ctx.textAlign = clip.align || 'center';
        ctx.textBaseline = 'middle';
        const x = (clip.x ?? 0.5) * W + ts.dx * W;
        const y = (clip.y ?? 0.8) * H;
        if (clip.bg) {
          const m = ctx.measureText(clip.text || '');
          const padX = 16, padY = 10;
          const tw = m.width;
          const th = (clip.fontSize || 48);
          let bx = x;
          if ((clip.align || 'center') === 'center') bx = x - tw / 2;
          else if ((clip.align) === 'right') bx = x - tw;
          ctx.save();
          ctx.globalAlpha = (clip.opacity ?? 1) * ts.alpha * 0.6;
          ctx.fillStyle = clip.bg;
          ctx.fillRect(bx - padX, y - th / 2 - padY, tw + padX * 2, th + padY * 2);
          ctx.restore();
          ctx.fillStyle = clip.color || '#ffffff';
        }
        if (clip.stroke) {
          ctx.lineWidth = clip.strokeWidth || 3;
          ctx.strokeStyle = clip.stroke;
          ctx.strokeText(clip.text || '', x, y);
        }
        ctx.fillText(clip.text || '', x, y);
      } else if (track.type === 'shape') {
        ctx.globalAlpha = (clip.opacity ?? 0.8) * ts.alpha;
        ctx.fillStyle = clip.color || '#ff4b3a';
        const cx = (clip.x ?? 0.5) * W + ts.dx * W;
        const cy = (clip.y ?? 0.5) * H;
        const w = (clip.w ?? 0.2) * W * ts.scale;
        const h = (clip.h ?? 0.1) * H * ts.scale;
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
