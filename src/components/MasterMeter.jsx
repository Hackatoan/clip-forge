import { useRef, useEffect, useState } from 'react';
import { store } from '../store/editorStore';
import { mediaEngine } from '../engine/mediaEngine';
import styles from './Toolbar.module.css';

export default function MasterMeter() {
  const fillRef = useRef(null);
  const rafRef = useRef(null);
  const [vol, setVol] = useState(1);

  useEffect(() => {
    const analyser = mediaEngine.getAnalyser();
    const data = new Uint8Array(analyser.fftSize);
    let peak = 0;
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const x = (data[i] - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, rms * 2.2);
      peak = Math.max(level, peak * 0.9); // smooth decay
      if (fillRef.current) fillRef.current.style.width = `${Math.round(peak * 100)}%`;
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const onVol = e => { const v = +e.target.value; setVol(v); mediaEngine.setMasterVolume(v); store.setPlaying(store.getState().playing); };

  return (
    <div className={styles.meter} title="Master output level & volume">
      <div className={styles.meterBar}><div ref={fillRef} className={styles.meterFill} /></div>
      <input type="range" min="0" max="1.5" step="0.01" value={vol} onChange={onVol}
        className={styles.meterVol} title={`Master volume ${Math.round(vol * 100)}%`} />
    </div>
  );
}
