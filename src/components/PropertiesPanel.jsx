import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import { hasKeyframes } from '../engine/keyframes';
import { reverseAudio } from '../engine/audioReverse';
import styles from './Panel.module.css';

const TRANSITIONS = ['none', 'fade', 'fade-black', 'fade-white', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out'];
const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'lighten', 'darken', 'add'];
const FILTER_PRESETS = {
  None:    { brightness: 1, contrast: 1, saturate: 1, blur: 0, grayscale: 0, sepia: 0, hue: 0 },
  'B&W':   { brightness: 1, contrast: 1.05, saturate: 1, blur: 0, grayscale: 1, sepia: 0, hue: 0 },
  Vintage: { brightness: 1.05, contrast: 1.1, saturate: 0.8, blur: 0, grayscale: 0, sepia: 0.4, hue: 0 },
  Warm:    { brightness: 1.05, contrast: 1, saturate: 1.2, blur: 0, grayscale: 0, sepia: 0.15, hue: 0 },
  Cool:    { brightness: 0.98, contrast: 1.05, saturate: 1.1, blur: 0, grayscale: 0, sepia: 0, hue: 200 },
  Vivid:   { brightness: 1.02, contrast: 1.15, saturate: 1.5, blur: 0, grayscale: 0, sepia: 0, hue: 0 },
};

// A row in the keyframe section: add @ playhead / clear.
function KfRow({ clip, prop, label, localTime, inRange }) {
  const on = hasKeyframes(clip, prop);
  const count = on ? clip.keyframes[prop].length : 0;
  return (
    <div className={styles.kfRow}>
      <span className={`${styles.kfName} ${on ? styles.kfOn : ''}`}>◆ {label}{count ? ` (${count})` : ''}</span>
      <button className={styles.chip} disabled={!inRange}
        title={inRange ? 'Add keyframe at playhead' : 'Move playhead over this clip'}
        onClick={() => store.addKeyframe(clip.id, prop, localTime, clip[prop] ?? defaultFor(prop))}>+@</button>
      <button className={styles.chip} disabled={!on}
        onClick={() => store.clearKeyframes(clip.id, prop)}>✕</button>
    </div>
  );
}

function defaultFor(prop) {
  return ({ opacity: 1, scale: 1, x: 0.5, y: 0.5, rotation: 0, volume: 1 })[prop] ?? 0;
}

export default function PropertiesPanel() {
  const { tracks, selectedClipId, selectedTrackId, playhead } = useStore(s => s);

  const track = tracks.find(t => t.id === selectedTrackId);
  const clip = track?.clips.find(c => c.id === selectedClipId);

  if (!clip) return (
    <div className={styles.panel}>
      <div className={styles.empty} style={{ marginTop: 32, textAlign: 'center' }}>
        Select a clip in the timeline to see properties.
      </div>
    </div>
  );

  const upd = patch => store.updateClip(clip.id, patch);
  const reverse = async () => {
    if (track.type === 'video') { upd({ reversed: !clip.reversed }); return; }
    if (track.type === 'audio' || track.type === 'voiceover') {
      try {
        const url = await reverseAudio(clip.src);
        store.updateClip(clip.id, { src: url, wave: null, reversed: !clip.reversed });
      } catch { /* ignore */ }
    }
  };
  const isVisual = track.type === 'video' || track.type === 'image';
  const isAudio = track.type === 'audio' || track.type === 'voiceover';
  const hasSpeed = track.type === 'video' || isAudio;
  const localTime = +(playhead - clip.start).toFixed(3);
  const inRange = localTime >= 0 && localTime <= clip.duration;

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Clip · {track.type}</div>
        <label className={styles.field}>
          <span>Name</span>
          <input type="text" value={clip.name || ''} onChange={e => upd({ name: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Start (s)</span>
          <input type="number" step="0.1" value={clip.start.toFixed(2)}
            onChange={e => upd({ start: +e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Duration (s)</span>
          <input type="number" step="0.1" value={clip.duration.toFixed(2)}
            onChange={e => upd({ duration: +e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Lock</span>
          <input type="checkbox" checked={!!clip.locked} onChange={e => upd({ locked: e.target.checked })} />
        </label>
      </div>

      {/* Speed */}
      {hasSpeed && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Speed</div>
          <label className={styles.field}>
            <span>Playback rate {(clip.speed ?? 1).toFixed(2)}×</span>
            <input type="range" min="0.25" max="4" step="0.05" value={clip.speed ?? 1}
              onChange={e => upd({ speed: +e.target.value })} />
          </label>
          <div className={styles.btnRow}>
            {[0.5, 1, 1.5, 2].map(s => (
              <button key={s} className={styles.chip} onClick={() => upd({ speed: s })}>{s}×</button>
            ))}
          </div>
          <button className={`${styles.secondaryBtn} ${clip.reversed ? styles.chipOn : ''}`} style={{ marginTop: 6 }}
            onClick={reverse} title="Play this clip backwards">
            ⏪ Reverse{clip.reversed ? ' (on)' : ''}
          </button>
        </div>
      )}

      {/* Transform (video / image) */}
      {isVisual && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Transform</div>
          <label className={styles.field}>
            <span>Fit</span>
            <select value={clip.fit || 'cover'} onChange={e => upd({ fit: e.target.value })}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill / Stretch</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Scale {Math.round((clip.scale ?? 1) * 100)}%</span>
            <input type="range" min="0.1" max="3" step="0.01" value={clip.scale ?? 1}
              onChange={e => upd({ scale: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Position X</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.x ?? 0.5}
              onChange={e => upd({ x: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Position Y</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.y ?? 0.5}
              onChange={e => upd({ y: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Rotation {clip.rotation ?? 0}°</span>
            <input type="range" min="-180" max="180" step="1" value={clip.rotation ?? 0}
              onChange={e => upd({ rotation: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Opacity {Math.round((clip.opacity ?? 1) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.opacity ?? 1}
              onChange={e => upd({ opacity: +e.target.value })} />
          </label>
          <div className={styles.btnRow}>
            <button className={`${styles.chip} ${clip.flipH ? styles.chipOn : ''}`}
              onClick={() => upd({ flipH: !clip.flipH })}>⇄ Flip H</button>
            <button className={`${styles.chip} ${clip.flipV ? styles.chipOn : ''}`}
              onClick={() => upd({ flipV: !clip.flipV })}>⇅ Flip V</button>
          </div>
          <div className={styles.sectionTitle} style={{ marginTop: 10 }}>Ken Burns</div>
          <div className={styles.btnRow}>
            <button className={styles.chip} onClick={() => store.kenBurns(clip.id, 'in')}>⤢ Zoom in</button>
            <button className={styles.chip} onClick={() => store.kenBurns(clip.id, 'out')}>⤡ Zoom out</button>
          </div>
        </div>
      )}

      {/* Keyframe animation */}
      {(isVisual || track.type === 'text' || track.type === 'shape' || isAudio) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Animation ◆</div>
          <p className={styles.hint}>Set a value, move the playhead, then + to keyframe.</p>
          {(isVisual || track.type === 'text' || track.type === 'shape') && <>
            <KfRow clip={clip} prop="opacity" label="Opacity" localTime={localTime} inRange={inRange} />
            <KfRow clip={clip} prop="scale" label="Scale" localTime={localTime} inRange={inRange} />
            <KfRow clip={clip} prop="x" label="Position X" localTime={localTime} inRange={inRange} />
            <KfRow clip={clip} prop="y" label="Position Y" localTime={localTime} inRange={inRange} />
            <KfRow clip={clip} prop="rotation" label="Rotation" localTime={localTime} inRange={inRange} />
          </>}
          {isAudio && <KfRow clip={clip} prop="volume" label="Volume" localTime={localTime} inRange={inRange} />}
        </div>
      )}

      {/* Blend mode (video / image) */}
      {isVisual && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Blend mode</div>
          <select value={clip.blend || 'normal'} onChange={e => upd({ blend: e.target.value })}>
            {BLENDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {/* Chroma key / green screen (video / image) */}
      {isVisual && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Chroma key (green screen)</div>
          <label className={styles.field}>
            <span>Enable</span>
            <input type="checkbox" checked={!!clip.chroma?.enabled}
              onChange={e => upd({ chroma: { color: '#00ff00', similarity: 0.4, smoothness: 0.1, ...clip.chroma, enabled: e.target.checked } })} />
          </label>
          {clip.chroma?.enabled && <>
            <label className={styles.field}>
              <span>Key colour</span>
              <input type="color" value={clip.chroma.color || '#00ff00'} style={{ height: 30, padding: 2, width: '100%' }}
                onChange={e => upd({ chroma: { ...clip.chroma, color: e.target.value } })} />
            </label>
            <div className={styles.btnRow}>
              <button className={styles.chip} onClick={() => upd({ chroma: { ...clip.chroma, color: '#00ff00' } })}>Green</button>
              <button className={styles.chip} onClick={() => upd({ chroma: { ...clip.chroma, color: '#0000ff' } })}>Blue</button>
            </div>
            <label className={styles.field}>
              <span>Similarity {Math.round((clip.chroma.similarity ?? 0.4) * 100)}%</span>
              <input type="range" min="0.05" max="1" step="0.01" value={clip.chroma.similarity ?? 0.4}
                onChange={e => upd({ chroma: { ...clip.chroma, similarity: +e.target.value } })} />
            </label>
            <label className={styles.field}>
              <span>Edge softness {Math.round((clip.chroma.smoothness ?? 0.1) * 100)}%</span>
              <input type="range" min="0" max="0.5" step="0.01" value={clip.chroma.smoothness ?? 0.1}
                onChange={e => upd({ chroma: { ...clip.chroma, smoothness: +e.target.value } })} />
            </label>
          </>}
        </div>
      )}

      {/* Filters (video / image) */}
      {isVisual && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Filters</div>
          <div className={styles.presetGrid}>
            {Object.entries(FILTER_PRESETS).map(([name, p]) => (
              <button key={name} className={styles.chip} onClick={() => upd(p)}>{name}</button>
            ))}
          </div>
          <label className={styles.field}>
            <span>Brightness {Math.round((clip.brightness ?? 1) * 100)}%</span>
            <input type="range" min="0" max="2" step="0.01" value={clip.brightness ?? 1}
              onChange={e => upd({ brightness: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Contrast {Math.round((clip.contrast ?? 1) * 100)}%</span>
            <input type="range" min="0" max="2" step="0.01" value={clip.contrast ?? 1}
              onChange={e => upd({ contrast: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Saturation {Math.round((clip.saturate ?? 1) * 100)}%</span>
            <input type="range" min="0" max="2" step="0.01" value={clip.saturate ?? 1}
              onChange={e => upd({ saturate: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Blur {clip.blur ?? 0}px</span>
            <input type="range" min="0" max="20" step="0.5" value={clip.blur ?? 0}
              onChange={e => upd({ blur: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Grayscale {Math.round((clip.grayscale ?? 0) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.grayscale ?? 0}
              onChange={e => upd({ grayscale: +e.target.value })} />
          </label>
          <button className={styles.secondaryBtn} style={{ marginTop: 6 }}
            onClick={() => upd({ brightness: 1, contrast: 1, saturate: 1, blur: 0, grayscale: 0, sepia: 0 })}>
            Reset filters
          </button>
        </div>
      )}

      {/* Audio/Voiceover */}
      {isAudio && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Audio</div>
          <label className={styles.field}>
            <span>Volume {Math.round((clip.volume ?? 1) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01"
              value={clip.volume ?? 1} onChange={e => upd({ volume: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Fade in {clip.fadeIn ?? 0}s</span>
            <input type="range" min="0" max="5" step="0.1" value={clip.fadeIn ?? 0}
              onChange={e => upd({ fadeIn: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Fade out {clip.fadeOut ?? 0}s</span>
            <input type="range" min="0" max="5" step="0.1" value={clip.fadeOut ?? 0}
              onChange={e => upd({ fadeOut: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Mute</span>
            <input type="checkbox" checked={!!clip.muted} onChange={e => upd({ muted: e.target.checked })} />
          </label>
        </div>
      )}

      {/* Video also gets fade + mute for its embedded audio */}
      {track.type === 'video' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Audio (from video)</div>
          <label className={styles.field}>
            <span>Volume {Math.round((clip.volume ?? 1) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.volume ?? 1}
              onChange={e => upd({ volume: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Mute</span>
            <input type="checkbox" checked={!!clip.muted} onChange={e => upd({ muted: e.target.checked })} />
          </label>
        </div>
      )}

      {/* Text */}
      {track.type === 'text' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Text</div>
          <label className={styles.field}>
            <span>Content</span>
            <textarea rows={2} value={clip.text || ''} onChange={e => upd({ text: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Font size</span>
            <input type="number" value={clip.fontSize || 36} onChange={e => upd({ fontSize: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Color</span>
            <input type="color" value={clip.color || '#ffffff'} onChange={e => upd({ color: e.target.value })}
              style={{ height: 30, padding: 2, width: '100%' }} />
          </label>
          <div className={styles.btnRow}>
            <button className={`${styles.chip} ${clip.bold ? styles.chipOn : ''}`}
              onClick={() => upd({ bold: !clip.bold })}><b>B</b></button>
            <button className={`${styles.chip} ${clip.italic ? styles.chipOn : ''}`}
              onClick={() => upd({ italic: !clip.italic })}><i>I</i></button>
          </div>
          <label className={styles.field}>
            <span>Align</span>
            <select value={clip.align || 'center'} onChange={e => upd({ align: e.target.value })}>
              <option>left</option><option>center</option><option>right</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Background</span>
            <input type="color" value={clip.bg || '#000000'} onChange={e => upd({ bg: e.target.value })}
              style={{ height: 30, padding: 2, width: '100%' }} />
          </label>
          <button className={styles.secondaryBtn} onClick={() => upd({ bg: null })}>No background</button>
          <label className={styles.field}>
            <span>X pos (0–1)</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.x ?? 0.5}
              onChange={e => upd({ x: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Y pos (0–1)</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.y ?? 0.8}
              onChange={e => upd({ y: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Opacity {Math.round((clip.opacity ?? 1) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.opacity ?? 1}
              onChange={e => upd({ opacity: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Scale {Math.round((clip.scale ?? 1) * 100)}%</span>
            <input type="range" min="0.1" max="3" step="0.01" value={clip.scale ?? 1}
              onChange={e => upd({ scale: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Rotation {clip.rotation ?? 0}°</span>
            <input type="range" min="-180" max="180" step="1" value={clip.rotation ?? 0}
              onChange={e => upd({ rotation: +e.target.value })} />
          </label>
        </div>
      )}

      {/* Shape */}
      {track.type === 'shape' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Shape</div>
          <label className={styles.field}>
            <span>Type</span>
            <select value={clip.shape || 'rect'} onChange={e => upd({ shape: e.target.value })}>
              <option value="rect">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="triangle">Triangle</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Color</span>
            <input type="color" value={clip.color || '#ff4b3a'} onChange={e => upd({ color: e.target.value })}
              style={{ height: 30, padding: 2, width: '100%' }} />
          </label>
          <label className={styles.field}>
            <span>Opacity {Math.round((clip.opacity ?? 0.8) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.opacity ?? 0.8}
              onChange={e => upd({ opacity: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>X (0–1)</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.x ?? 0.5} onChange={e => upd({ x: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Y (0–1)</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.y ?? 0.5} onChange={e => upd({ y: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Width (0–1)</span>
            <input type="range" min="0.01" max="1" step="0.01" value={clip.w ?? 0.2} onChange={e => upd({ w: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Height (0–1)</span>
            <input type="range" min="0.01" max="1" step="0.01" value={clip.h ?? 0.1} onChange={e => upd({ h: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Scale {Math.round((clip.scale ?? 1) * 100)}%</span>
            <input type="range" min="0.1" max="3" step="0.01" value={clip.scale ?? 1}
              onChange={e => upd({ scale: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Rotation {clip.rotation ?? 0}°</span>
            <input type="range" min="-180" max="180" step="1" value={clip.rotation ?? 0}
              onChange={e => upd({ rotation: +e.target.value })} />
          </label>
        </div>
      )}

      {/* Transitions */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Transitions</div>
        <label className={styles.field}>
          <span>In</span>
          <select value={clip.transitionIn || clip.transition || 'none'}
            onChange={e => upd({ transitionIn: e.target.value, transition: undefined })}>
            {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>In duration {(clip.transInDur ?? 0.5).toFixed(2)}s</span>
          <input type="range" min="0.1" max="3" step="0.05" value={clip.transInDur ?? 0.5}
            onChange={e => upd({ transInDur: +e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Out</span>
          <select value={clip.transitionOut || clip.transition || 'none'}
            onChange={e => upd({ transitionOut: e.target.value, transition: undefined })}>
            {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Out duration {(clip.transOutDur ?? 0.5).toFixed(2)}s</span>
          <input type="range" min="0.1" max="3" step="0.05" value={clip.transOutDur ?? 0.5}
            onChange={e => upd({ transOutDur: +e.target.value })} />
        </label>
        <button className={styles.secondaryBtn} style={{ marginTop: 6 }}
          onClick={() => store.crossfadePrev(clip.id, clip.transInDur ?? 0.5)}
          title="Overlap with the previous clip on this track and dissolve between them">
          ⇄ Crossfade with previous
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.btnRow}>
          <button className={styles.secondaryBtn} onClick={() => store.duplicateClip(clip.id)}>⧉ Duplicate</button>
          <button className={styles.secondaryBtn} onClick={() => store.splitClip(clip.id, store.getState().playhead)}>✂ Split</button>
        </div>
        <button className={styles.dangerBtn} style={{ marginTop: 6 }} onClick={() => store.removeClip(clip.id)}>🗑 Delete Clip</button>
      </div>
    </div>
  );
}
