import { useState, useEffect, useRef } from 'react';
import Toolbar from './components/Toolbar';
import Preview from './components/Preview';
import Timeline from './components/Timeline';
import PropertiesPanel from './components/PropertiesPanel';
import MediaPanel from './components/MediaPanel';
import FeatureRequest from './components/FeatureRequest';
import ExportModal from './components/ExportModal';
import ShortcutsModal from './components/ShortcutsModal';
import { store } from './store/editorStore';
import { loadFFmpeg, isCrossOriginIsolated } from './engine/ffmpeg';
import { importFiles, filesFromDataTransfer } from './engine/importMedia';
import styles from './App.module.css';

export default function App() {
  const [activePanel, setActivePanel] = useState('media'); // media | properties | features
  const [showExport, setShowExport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

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
        if (s.selectedClipId) { e.preventDefault(); store.duplicateSelected(); }
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault(); store.selectAll();
      } else if (e.code === 'Space') {
        e.preventDefault(); store.setPlaying(!s.playing);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedClipId || s.selectedClipIds.length) { e.preventDefault(); store.removeSelected(); }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); store.setPlayhead(s.playhead - (e.shiftKey ? 1 : 0.1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); store.setPlayhead(s.playhead + (e.shiftKey ? 1 : 0.1));
      } else if (e.key === 'Home') {
        e.preventDefault(); store.setPlayhead(0);
      } else if (e.key === 'End') {
        e.preventDefault(); store.setPlayhead(s.duration);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault(); store.addMarker();
      } else if (e.key === '?') {
        e.preventDefault(); setShowHelp(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // App-wide file drag-and-drop (drops on the timeline are handled there and
  // stop propagation; this catches drops anywhere else and imports at playhead).
  const isFileDrag = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  const onDragEnter = e => { if (!isFileDrag(e)) return; e.preventDefault(); dragDepth.current++; setDragging(true); };
  const onDragOver = e => { if (isFileDrag(e)) e.preventDefault(); };
  const onDragLeave = e => { if (!isFileDrag(e)) return; if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } };
  const onDrop = async e => {
    if (!isFileDrag(e)) return;
    e.preventDefault(); dragDepth.current = 0; setDragging(false);
    const files = await filesFromDataTransfer(e.dataTransfer);
    if (files.length) importFiles(files, { groupByType: true });
  };

  return (
    <div className={styles.app} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {dragging && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropBox}>⬇ Drop media to import<br /><span>onto a timeline track, or anywhere for a new layer</span></div>
        </div>
      )}
      <Toolbar onPanel={setActivePanel} activePanel={activePanel} onExport={() => setShowExport(true)} onHelp={() => setShowHelp(true)} />
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
      {showHelp && <ShortcutsModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
