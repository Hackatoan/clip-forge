import { useState, useEffect } from 'react';
import Landing from './components/Landing';
import Editor from './components/Editor';

// Simple hash routing: '/' shows the marketing landing page, '#editor' opens
// the editor. Keeps the editor a bookmarkable/shareable deep link.
export default function App() {
  const [view, setView] = useState(() => window.location.hash === '#editor' ? 'editor' : 'landing');

  useEffect(() => {
    const onHash = () => setView(window.location.hash === '#editor' ? 'editor' : 'landing');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openEditor = () => { window.location.hash = 'editor'; setView('editor'); };
  const goHome = () => {
    history.pushState('', document.title, window.location.pathname + window.location.search);
    setView('landing');
  };

  return view === 'editor'
    ? <Editor onHome={goHome} />
    : <Landing onLaunch={openEditor} />;
}
