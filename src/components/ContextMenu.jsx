import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { menuStore } from '../store/menuStore';
import styles from './ContextMenu.module.css';

export default function ContextMenu() {
  const [s, setS] = useState(menuStore.getState());
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => menuStore.subscribe(setS), []);

  // Close on any click, scroll, resize, or Escape.
  useEffect(() => {
    if (!s.open) return;
    const close = () => menuStore.close();
    const onKey = e => { if (e.key === 'Escape') menuStore.close(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [s.open]);

  // Keep the menu on-screen: flip/clamp against the viewport.
  useLayoutEffect(() => {
    if (!s.open || !ref.current) return;
    const m = ref.current.getBoundingClientRect();
    const pad = 6;
    let x = s.x, y = s.y;
    if (x + m.width + pad > window.innerWidth) x = window.innerWidth - m.width - pad;
    if (y + m.height + pad > window.innerHeight) y = window.innerHeight - m.height - pad;
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }, [s.open, s.x, s.y, s.items]);

  if (!s.open) return null;

  return (
    <div ref={ref} className={styles.menu} style={{ left: pos.x, top: pos.y }}
      onMouseDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      {s.items.map((it, i) => it.divider
        ? <div key={i} className={styles.divider} />
        : (
          <button key={i} className={`${styles.item} ${it.danger ? styles.danger : ''}`}
            disabled={it.disabled}
            onClick={() => { menuStore.close(); it.onClick?.(); }}>
            {it.label}
            {it.shortcut && <span className={styles.shortcut}>{it.shortcut}</span>}
          </button>
        ))}
    </div>
  );
}
