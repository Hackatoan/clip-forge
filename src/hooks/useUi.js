import { useState, useEffect } from 'react';
import { uiStore } from '../store/uiStore';

export function useUi() {
  const [s, setS] = useState(uiStore.getState());
  useEffect(() => uiStore.subscribe(setS), []);
  return s;
}
