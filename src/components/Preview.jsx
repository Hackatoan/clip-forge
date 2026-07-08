import { useRef, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import { mediaEngine } from '../engine/mediaEngine';
import { renderFrame } from '../engine/render';
import styles from './Preview.module.css';

export default function Preview() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startWallRef = useRef(0);
  const startPhRef = useRef(0);

  const { tracks, playing, playhead, duration } = useStore(s => ({
    tracks: s.tracks, playing: s.playing,
    playhead: s.playhead, duration: s.duration,
  }));

  const draw = (ph) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    renderFrame(ctx, canvas.width, canvas.height, tracks, ph);
  };

  // Keep media elements reconciled with the timeline.
  useEffect(() => { mediaEngine.sync(tracks); }, [tracks]);

  // Playback loop.
  useEffect(() => {
    if (playing) {
      mediaEngine.play(playhead, tracks);
      startWallRef.current = performance.now();
      startPhRef.current = playhead;
      const loop = () => {
        const elapsed = (performance.now() - startWallRef.current) / 1000;
        const newPh = startPhRef.current + elapsed;
        if (newPh >= duration) {
          store.setPlaying(false);
          store.setPlayhead(duration);
          mediaEngine.pause();
          draw(duration);
          return;
        }
        mediaEngine.tick(newPh, tracks);
        store.setPlayhead(newPh);
        draw(newPh);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
      mediaEngine.pause();
      mediaEngine.seek(playhead, tracks);
      draw(playhead);
    }
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Redraw on scrub / edit while paused.
  useEffect(() => {
    if (!playing) {
      mediaEngine.seek(playhead, tracks);
      // Give video elements a moment to seek before drawing.
      draw(playhead);
      const id = setTimeout(() => draw(playhead), 60);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playhead, tracks]);

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
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}
