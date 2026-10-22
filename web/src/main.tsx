import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import App from './App';
import { MetaProvider } from './meta';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MetaProvider>
      <App />
    </MetaProvider>
  </StrictMode>,
);
