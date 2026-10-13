import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En el navegador Fragrantica no deja leer su web (CORS): en desarrollo pasa por aquí.
// En el móvil no hace falta: la app la descarga con la conexión nativa de Capacitor.
const fragrantica = (host) => ({
  target: `https://${host}`,
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/fragrantica-(es|com)/, ''),
});

// base './' para que los assets carguen bien dentro del WebView de Capacitor
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/fragrantica-es': fragrantica('www.fragrantica.es'),
      '/fragrantica-com': fragrantica('www.fragrantica.com'),
    },
  },
});
