import { useState } from 'react';
import Toolbar from './components/Toolbar';
import Preview from './components/Preview';
import Timeline from './components/Timeline';
import PropertiesPanel from './components/PropertiesPanel';
import MediaPanel from './components/MediaPanel';
import FeatureRequest from './components/FeatureRequest';
import styles from './App.module.css';

export default function App() {
  const [activePanel, setActivePanel] = useState('media'); // media | properties | features

  return (
    <div className={styles.app}>
      <Toolbar onPanel={setActivePanel} activePanel={activePanel} />
      <div className={styles.main}>
        <div className={styles.sidebar}>
          {activePanel === 'media'      && <MediaPanel />}
          {activePanel === 'properties' && <PropertiesPanel />}
          {activePanel === 'features'   && <FeatureRequest />}
        </div>
        <div className={styles.center}>
          <Preview />
          <Timeline />
        </div>
      </div>
    </div>
  );
}
