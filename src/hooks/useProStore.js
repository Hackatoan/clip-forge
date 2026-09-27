import { useState, useEffect } from 'react';
import { proStore } from '../store/proStore';

export function useProStore() {
  const [s, setS] = useState(proStore.getState());
  useEffect(() => proStore.subscribe(setS), []);
  return s;
}
