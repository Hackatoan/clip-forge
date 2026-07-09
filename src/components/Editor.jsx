import { useState, useEffect, useRef } from 'react';
import Toolbar from './Toolbar';
import Preview from './Preview';
import Timeline from './Timeline';
import PropertiesPanel from './PropertiesPanel';
import MediaPanel from './MediaPanel';
import FeatureRequest from './FeatureRequest';
import ExportModal from './ExportModal';
import ShortcutsModal from './ShortcutsModal';
import SettingsModal from './SettingsModal';
import ContextMenu from './ContextMenu';
import { store } from '../store/editorStore';
import { uiStore } from '../store/uiStore';
import { useUi } from '../hooks/useUi';
import { loadFFmpeg, isCrossOriginIsolated } from '../engine/ffmpeg';
import { importFiles, filesFromDataTransfer } from '../engine/importMedia';
import styles from '../App.module.css';

export default function Editor({ onHome }) {
  const [activePanel, setActivePanel] = useState('media'); // media | properties | features
  const [showExport, setShowExport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const ui = useUi();

  // Drag a panel divider to resize the sidebar (v) or timeline (h).
  const startResize = (axis) => (e) => {
    e.preventDefault();
    const s0 = uiStore.getState();
    const startX = e.clientX, startY = e.clientY;
    const move = ev => {
      if (axis === 'v') {
        let dx = ev.clientX - startX;
        if (s0.sidebarPos === 'right') dx = -dx;
        uiStore.set({ sidebarWidth: uiStore.clamp(s0.sidebarWidth + dx, 180, 560) });
      } else {
        uiStore.set({ timelineHeight: uiStore.clamp(s0.timelineHeight - (ev.clientY - startY), 120, 640) });
      }
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Preload ffmpeg.wasm in the background (only useful if cross-origin isolated).
  useEffect(() => {
    if (isCrossOriginIsolated()) {
      loadFFmpeg().then(() => store.setFFmpegReady(true)).catch(() => {});
    } else {
      store.setFFmpegReady(true); // WebM export still works without it.
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

  // App-wide file drag-and-drop (timeline drops stop propagation; this catches
  // drops anywhere else and imports at the playhead).
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
      <Toolbar onPanel={setActivePanel} activePanel={activePanel} onHome={onHome}
        onExport={() => setShowExport(true)} onHelp={() => setShowHelp(true)} onSettings={() => setShowSettings(true)} />

      {/* iMovie-style: browser + viewer on top, full-width timeline below. */}
      <div className={styles.top} style={{ flexDirection: ui.sidebarPos === 'right' ? 'row-reverse' : 'row' }}>
        <div className={styles.sidebar}>
          {activePanel === 'media'      && <MediaPanel />}
          {activePanel === 'properties' && <PropertiesPanel />}
          {activePanel === 'features'   && <FeatureRequest />}
        </div>
        <div className={styles.resizeV} onMouseDown={startResize('v')} title="Drag to resize panel" />
        <Preview />
      </div>
      <div className={styles.resizeH} onMouseDown={startResize('h')} title="Drag to resize timeline" />
      <Timeline />

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showHelp && <ShortcutsModal onClose={() => setShowHelp(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <ContextMenu />
    </div>
  );
}
