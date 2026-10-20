import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import { StoreProvider } from './lib/store.jsx';
import { ToastProvider } from './components/ui.jsx';
import App from './App.jsx';
import { setupPwa } from './lib/pwa.js';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);

setupPwa();
