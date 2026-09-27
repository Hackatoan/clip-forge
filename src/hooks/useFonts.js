import { useState, useEffect } from 'react';
import { fontStore } from '../store/fontStore';

export function useFonts() {
  const [fonts, setFonts] = useState(fontStore.getState());
  useEffect(() => fontStore.subscribe(setFonts), []);
  return fonts;
}
