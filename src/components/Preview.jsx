import { useRef, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import { mediaEngine } from '../engine/mediaEngine';
import { renderFrame, captureFrame } from '../engine/render';
import { menuStore } from '../store/menuStore';
import styles from './Preview.module.css';

export default function Preview() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startWallRef = useRef(0);
  const startPhRef = useRef(0);

  const { tracks, playing, playhead, duration, loop, canvasW, canvasH } = useStore(s => ({
    tracks: s.tracks, playing: s.playing,
    playhead: s.playhead, duration: s.duration, loop: s.loop,
    canvasW: s.canvasW, canvasH: s.canvasH,
  }));

  const draw = (ph) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    renderFrame(ctx, canvas.width, canvas.height, tracks, ph);
  };

  // Keep media elements reconciled with the timeline.
  useEffect(() => { mediaEngine.sync(tracks); }, [tracks]);

  // Redraw when the canvas is resized (aspect-ratio change clears it).
  useEffect(() => { if (!playing) draw(playhead); }, [canvasW, canvasH]);

  // Playback loop.
  useEffect(() => {
    if (playing) {
      mediaEngine.play(playhead, tracks);
      startWallRef.current = performance.now();
      startPhRef.current = playhead;
      const step = () => {
        const elapsed = (performance.now() - startWallRef.current) / 1000;
        const newPh = startPhRef.current + elapsed;
        if (newPh >= duration) {
          if (loop) {
            // Restart from the beginning without stopping playback.
            store.setPlayhead(0);
            mediaEngine.pause();
            mediaEngine.play(0, tracks);
            startWallRef.current = performance.now();
            startPhRef.current = 0;
            draw(0);
            rafRef.current = requestAnimationFrame(step);
            return;
          }
          store.setPlaying(false);
          store.setPlayhead(duration);
          mediaEngine.pause();
          draw(duration);
          return;
        }
        mediaEngine.tick(newPh, tracks);
        store.setPlayhead(newPh);
        draw(newPh);
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
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

  const empty = tracks.length === 0;

  const onMenu = e => {
    e.preventDefault();
    const s = store.getState();
    menuStore.open(e.clientX, e.clientY, [
      { label: s.playing ? 'Pause' : 'Play', shortcut: 'Space', onClick: () => store.setPlaying(!s.playing) },
      { label: 'Freeze this frame', onClick: () => {
        const url = captureFrame(s.tracks, s.canvasW, s.canvasH, s.playhead);
        const tid = store.addTrack('image');
        store.addClip(tid, { src: url, name: 'Freeze frame', duration: 2, start: s.playhead, fit: 'cover' });
      } },
      { divider: true },
      { label: 'Jump to start', shortcut: 'Home', onClick: () => store.setPlayhead(0) },
      { label: 'Jump to end', shortcut: 'End', onClick: () => store.setPlayhead(s.duration) },
    ]);
  };

  return (
    <div className={styles.preview} onContextMenu={onMenu}>
      <div className={styles.stage} style={{ aspectRatio: `${canvasW} / ${canvasH}` }}>
        <canvas ref={canvasRef} width={canvasW} height={canvasH} className={styles.canvas} />
        {empty && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🎬</div>
            <div className={styles.emptyTitle}>Start your project</div>
            <div className={styles.emptyHint}>Add video, audio, or images from the Media panel — or drop in text and shapes.</div>
          </div>
        )}
      </div>
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
