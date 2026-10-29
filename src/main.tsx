import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/studio.css';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado em index.html.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
