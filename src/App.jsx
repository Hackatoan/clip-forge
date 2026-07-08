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

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const s = store.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo(); else store.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault(); store.redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        if (s.selectedClipId) { e.preventDefault(); store.copyClip(s.selectedClipId); }
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault(); store.pasteClip();
      } else if (mod && e.key.toLowerCase() === 'd') {
        if (s.selectedClipId) { e.preventDefault(); store.duplicateClip(s.selectedClipId); }
      } else if (e.code === 'Space') {
        e.preventDefault(); store.setPlaying(!s.playing);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedClipId) { e.preventDefault(); store.removeClip(s.selectedClipId); }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); store.setPlayhead(s.playhead - (e.shiftKey ? 1 : 0.1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); store.setPlayhead(s.playhead + (e.shiftKey ? 1 : 0.1));
      } else if (e.key === 'Home') {
        e.preventDefault(); store.setPlayhead(0);
      } else if (e.key === 'End') {
        e.preventDefault(); store.setPlayhead(s.duration);
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
