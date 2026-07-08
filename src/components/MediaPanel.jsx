import { useRef } from 'react';
import { store } from '../store/editorStore';
import { useStore } from '../hooks/useStore';
import styles from './Panel.module.css';

export default function MediaPanel() {
  const fileRef = useRef(null);
  const micRef = useRef(null);
  const recordRef = useRef(null);
  const tracks = useStore(s => s.tracks);

  const addMedia = (files) => {
    Array.from(files).forEach(file => {
      const src = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio');
      const type = isVideo ? 'video' : isAudio ? 'audio' : null;
      if (!type) return;
      const trackId = store.addTrack(type);
      store.addClip(trackId, { src, name: file.name, duration: 10 });
      // Get actual duration
      const el = document.createElement(isVideo ? 'video' : 'audio');
      el.src = src;
      el.onloadedmetadata = () => {
        store.updateClip(
          store.getState().tracks.find(t=>t.id===trackId)?.clips.slice(-1)[0]?.id,
          { duration: el.duration }
        );
      };
    });
  };

  const addText = () => {
    const trackId = store.addTrack('text');
    store.addClip(trackId, { text: 'Text here', duration: 5, x: 0.5, y: 0.8, fontSize: 48, color: '#ffffff' });
  };

  const addShape = (shape) => {
    const trackId = store.addTrack('shape');
    store.addClip(trackId, { shape, duration: 5, x: 0.5, y: 0.5, w: 0.2, h: 0.1, color: '#ff4b3a', opacity: 0.8 });
  };

  // Voiceover recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const src = URL.createObjectURL(blob);
        const trackId = store.addTrack('voiceover');
        store.addClip(trackId, { src, name: 'Voiceover', duration: chunks.length * 0.5 });
        stream.getTracks().forEach(t => t.stop());
      };
      recordRef.current = recorder;
      recorder.start();
      micRef.current.textContent = '⏹ Stop Recording';
      micRef.current.onclick = () => { recorder.stop(); micRef.current.textContent = '🎙 Record Voiceover'; micRef.current.onclick = startRecording; };
    } catch {
      alert('Mic access denied');
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Import Media</div>
        <input ref={fileRef} type="file" multiple accept="video/*,audio/*" style={{ display: 'none' }}
          onChange={e => addMedia(e.target.files)} />
        <button className={styles.primaryBtn} onClick={() => fileRef.current.click()}>
          📂 Add Video / Audio
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Add Elements</div>
        <div className={styles.grid2}>
          <button className={styles.elemBtn} onClick={addText}>T Text</button>
          <button className={styles.elemBtn} onClick={() => addShape('rect')}>▭ Rectangle</button>
          <button className={styles.elemBtn} onClick={() => addShape('circle')}>◯ Circle</button>
          <button ref={micRef} className={styles.elemBtn} onClick={startRecording}>🎙 Voiceover</button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Tracks ({tracks.length})</div>
        <div className={styles.trackList}>
          {tracks.map(t => (
            <div key={t.id} className={styles.trackItem}>
              <span className={styles.trackType}>{t.type}</span>
              <span className={styles.trackName}>{t.name}</span>
              <span className={styles.trackCount}>{t.clips.length} clip{t.clips.length !== 1 ? 's' : ''}</span>
            </div>
          ))}
          {tracks.length === 0 && <p className={styles.empty}>No tracks yet. Add media above.</p>}
        </div>
      </div>
    </div>
  );
}
