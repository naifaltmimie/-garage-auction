import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './styles/base.css';
import './styles/app.css';
import './styles/fx.css';
import './styles/news.css';
import './styles/reactions.css';
import './styles/awards.css';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { installSpotlight } from './ui/components/fx/spotlight';

installSpotlight();

createRoot(document.getElementById('root')!).render(<App />);
