import { useState, useEffect } from 'react';
import Landing from './components/Landing';
import Editor from './components/Editor';
import Privacy from './components/Privacy';
import Terms from './components/Terms';

const HASH_VIEWS = { '#editor': 'editor', '#privacy': 'privacy', '#terms': 'terms' };

// Simple hash routing: '/' shows the marketing landing page, '#editor' opens
// the editor, '#privacy'/'#terms' show the legal pages. Keeps each a
// bookmarkable/shareable deep link.
export default function App() {
  const [view, setView] = useState(() => HASH_VIEWS[window.location.hash] || 'landing');

  useEffect(() => {
    const onHash = () => setView(HASH_VIEWS[window.location.hash] || 'landing');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openEditor = () => { window.location.hash = 'editor'; setView('editor'); };
  const goHome = () => {
    history.pushState('', document.title, window.location.pathname + window.location.search);
    setView('landing');
  };
  const goTo = (hash) => { window.location.hash = hash; setView(HASH_VIEWS[`#${hash}`] || 'landing'); };

  if (view === 'editor') return <Editor onHome={goHome} />;
  if (view === 'privacy') return <Privacy onHome={goHome} onTerms={() => goTo('terms')} />;
  if (view === 'terms') return <Terms onHome={goHome} onPrivacy={() => goTo('privacy')} />;
  return <Landing onLaunch={openEditor} />;
}
