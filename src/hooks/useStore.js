import { useState, useEffect } from 'react';
import { store } from '../store/editorStore';

export function useStore(selector) {
  const [val, setVal] = useState(() => selector(store.getState()));
  useEffect(() => {
    return store.subscribe(state => setVal(selector(state)));
  }, []);
  return val;
}
