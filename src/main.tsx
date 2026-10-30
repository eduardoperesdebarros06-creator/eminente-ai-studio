import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/studio.css';
import './styles/library.css';
import { App } from './app/App';
import { startLibrarySync } from './features/library/librarySync';

// Projetos e versões vão para a biblioteca (SQLite no servidor local).
startLibrarySync();

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado em index.html.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
