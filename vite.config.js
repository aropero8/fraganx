import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para que los assets carguen bien dentro del WebView de Capacitor
export default defineConfig({
  plugins: [react()],
  base: './',
});
