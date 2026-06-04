import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import styles from './Preview.module.css';

export default function Preview() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const startPlayheadRef = useRef(null);
  const videoEls = useRef({});

  const { tracks, playing, playhead, duration } = useStore(s => ({
    tracks: s.tracks, playing: s.playing,
    playhead: s.playhead, duration: s.duration,
  }));

  // Render a single frame
  const renderFrame = useCallback((ph) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    tracks.forEach(track => {
      if (track.muted) return;
      track.clips.forEach(clip => {
        if (ph < clip.start || ph > clip.start + clip.duration) return;
        const localTime = ph - clip.start + (clip.offset || 0);

        if (track.type === 'video' && clip.src) {
          const vid = videoEls.current[clip.id];
          if (vid && vid.readyState >= 2) {
            vid.currentTime = localTime;
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          }
        } else if (track.type === 'text') {
          ctx.save();
          ctx.font = `${clip.fontSize || 36}px ${clip.fontFamily || 'system-ui'}`;
          ctx.fillStyle = clip.color || '#ffffff';
          ctx.textAlign = clip.align || 'center';
          ctx.globalAlpha = clip.opacity ?? 1;
          const x = (clip.x ?? 0.5) * canvas.width;
          const y = (clip.y ?? 0.8) * canvas.height;
          ctx.fillText(clip.text || '', x, y);
          ctx.restore();
        } else if (track.type === 'shape') {
          ctx.save();
          ctx.globalAlpha = clip.opacity ?? 0.8;
          ctx.fillStyle = clip.color || '#ff4b3a';
          const cx = (clip.x ?? 0.5) * canvas.width;
          const cy = (clip.y ?? 0.5) * canvas.height;
          const w = (clip.w ?? 0.2) * canvas.width;
          const h = (clip.h ?? 0.1) * canvas.height;
          if (clip.shape === 'circle') {
            ctx.beginPath(); ctx.arc(cx, cy, Math.min(w,h)/2, 0, Math.PI*2); ctx.fill();
          } else {
            ctx.fillRect(cx - w/2, cy - h/2, w, h);
          }
          ctx.restore();
        }
      });
    });
  }, [tracks]);

  // Playback loop
  useEffect(() => {
    if (playing) {
      startTimeRef.current = performance.now();
      startPlayheadRef.current = playhead;
      const loop = () => {
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        const newPh = startPlayheadRef.current + elapsed;
        if (newPh >= duration) {
          store.setPlaying(false);
          store.setPlayhead(duration);
          return;
        }
        store.setPlayhead(newPh);
        renderFrame(newPh);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
      renderFrame(playhead);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  // Re-render on playhead scrub
  useEffect(() => {
    if (!playing) renderFrame(playhead);
  }, [playhead, tracks]);

  // Create hidden video elements for each video clip
  useEffect(() => {
    tracks.forEach(track => {
      if (track.type !== 'video') return;
      track.clips.forEach(clip => {
        if (!videoEls.current[clip.id] && clip.src) {
          const vid = document.createElement('video');
          vid.src = clip.src;
          vid.preload = 'auto';
          vid.muted = true;
          videoEls.current[clip.id] = vid;
        }
      });
    });
  }, [tracks]);

  return (
    <div className={styles.preview}>
      <canvas ref={canvasRef} width={1280} height={720} className={styles.canvas} />
      <div className={styles.timecode}>{fmt(playhead)} / {fmt(duration)}</div>
    </div>
  );
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
}
