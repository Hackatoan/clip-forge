import { useState, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import Preview from './components/Preview';
import Timeline from './components/Timeline';
import PropertiesPanel from './components/PropertiesPanel';
import MediaPanel from './components/MediaPanel';
import FeatureRequest from './components/FeatureRequest';
import ExportModal from './components/ExportModal';
import { store } from './store/editorStore';
import { loadFFmpeg, isCrossOriginIsolated } from './engine/ffmpeg';
import styles from './App.module.css';

export default function App() {
  const [activePanel, setActivePanel] = useState('media'); // media | properties | features
  const [showExport, setShowExport] = useState(false);

  // Preload ffmpeg.wasm in the background (only useful if cross-origin isolated).
  useEffect(() => {
    if (isCrossOriginIsolated()) {
      loadFFmpeg().then(() => store.setFFmpegReady(true)).catch(() => {});
    } else {
      // WebM export still works without it.
      store.setFFmpegReady(true);
    }
  }, []);

  // Keyboard shortcuts: space = play/pause, delete = remove clip.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        const s = store.getState();
        store.setPlaying(!s.playing);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const s = store.getState();
        if (s.selectedClipId) { e.preventDefault(); store.removeClip(s.selectedClipId); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={styles.app}>
      <Toolbar onPanel={setActivePanel} activePanel={activePanel} onExport={() => setShowExport(true)} />
      <div className={styles.main}>
        <div className={styles.sidebar}>
          {activePanel === 'media'      && <MediaPanel />}
          {activePanel === 'properties' && <PropertiesPanel />}
          {activePanel === 'features'   && <FeatureRequest />}
        </div>
        <div className={styles.center}>
          <Preview />
          <Timeline />
        </div>
      </div>
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  );
}
