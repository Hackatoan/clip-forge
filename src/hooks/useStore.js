import { useState, useEffect, useRef } from 'react';
import { store } from '../store/editorStore';

// Shallow-compare so selectors that return a fresh object/array literal each
// call (e.g. `s => ({ a: s.a, b: s.b })`) don't force a re-render when the
// picked-out values haven't actually changed — only the reference did.
function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every(k => Object.is(a[k], b[k]));
}

export function useStore(selector) {
  const [val, setVal] = useState(() => selector(store.getState()));
  const selectorRef = useRef(selector);
  const valRef = useRef(val);

  // Keep the refs current after each render (not during render, per the
  // rules of hooks) so the subscription below always sees the latest
  // selector/value without needing to resubscribe.
  useEffect(() => {
    selectorRef.current = selector;
    valRef.current = val;
  });

  useEffect(() => {
    return store.subscribe(state => {
      const next = selectorRef.current(state);
      if (!shallowEqual(valRef.current, next)) {
        valRef.current = next;
        setVal(next);
      }
    });
  }, []);
  return val;
}
