import { useRef, useState } from 'react';
import { store } from '../store/editorStore';
import { useStore } from '../hooks/useStore';
import { serializeProject, downloadProject, parseProject } from '../engine/project';
import { importFiles } from '../engine/importMedia';
import { captureFrame } from '../engine/render';
import styles from './Panel.module.css';

export default function MediaPanel() {
  const fileRef = useRef(null);
  const folderRef = useRef(null);
  const projRef = useRef(null);
  const micRef = useRef(null);
  const recordRef = useRef(null);
  const tracks = useStore(s => s.tracks);
  const [projMsg, setProjMsg] = useState('');

  const saveProject = async () => {
    setProjMsg('Saving…');
    try {
      const json = await serializeProject(store.getState(), p => setProjMsg(`Encoding media ${p}%`));
      downloadProject(json);
      setProjMsg('✅ Saved');
    } catch (e) {
      setProjMsg('⚠ ' + (e.message || e));
    }
    setTimeout(() => setProjMsg(''), 3000);
  };

  const loadProject = (file) => {
    if (!file) return;
    setProjMsg('Loading…');
    const fr = new FileReader();
    fr.onload = () => {
      try {
        store.loadProject(parseProject(fr.result));
        setProjMsg('✅ Loaded');
      } catch (e) {
        setProjMsg('⚠ ' + (e.message || e));
      }
      setTimeout(() => setProjMsg(''), 3000);
    };
    fr.readAsText(file);
  };

  const addText = () => {
    const trackId = store.addTrack('text');
    store.addClip(trackId, { text: 'Text here', duration: 5, x: 0.5, y: 0.8, fontSize: 48, color: '#ffffff' });
  };

  const addShape = (shape) => {
    const trackId = store.addTrack('shape');
    store.addClip(trackId, { shape, duration: 5, x: 0.5, y: 0.5, w: 0.2, h: 0.1, color: '#ff4b3a', opacity: 0.8 });
  };

  const freezeFrame = () => {
    const s = store.getState();
    const url = captureFrame(s.tracks, s.canvasW, s.canvasH, s.playhead);
    const trackId = store.addTrack('image');
    store.addClip(trackId, { src: url, name: 'Freeze frame', duration: 2, start: s.playhead, fit: 'cover' });
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
        <input ref={fileRef} type="file" multiple accept="video/*,audio/*,image/*" style={{ display: 'none' }}
          onChange={e => { importFiles(e.target.files, { groupByType: true }); e.target.value = ''; }} />
        <input ref={folderRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }}
          onChange={e => { importFiles(e.target.files, { groupByType: true }); e.target.value = ''; }} />
        <button className={styles.primaryBtn} onClick={() => fileRef.current.click()}>
          📂 Add Video / Audio / Image
        </button>
        <button className={styles.secondaryBtn} style={{ marginTop: 6 }} onClick={() => folderRef.current.click()}>
          🗂 Import Folder
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Add Elements</div>
        <div className={styles.grid2}>
          <button className={styles.elemBtn} onClick={addText}>T Text</button>
          <button className={styles.elemBtn} onClick={() => addShape('rect')}>▭ Rectangle</button>
          <button className={styles.elemBtn} onClick={() => addShape('circle')}>◯ Circle</button>
          <button ref={micRef} className={styles.elemBtn} onClick={startRecording}>🎙 Voiceover</button>
          <button className={styles.elemBtn} onClick={freezeFrame} title="Add a still of the current frame">❄ Freeze frame</button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Project</div>
        <input ref={projRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
          onChange={e => { loadProject(e.target.files[0]); e.target.value = ''; }} />
        <div className={styles.grid2}>
          <button className={styles.elemBtn} onClick={saveProject}>💾 Save</button>
          <button className={styles.elemBtn} onClick={() => projRef.current.click()}>📁 Load</button>
        </div>
        {projMsg && <p className={styles.hint} style={{ marginTop: 6 }}>{projMsg}</p>}
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
