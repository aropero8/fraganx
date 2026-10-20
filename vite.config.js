import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En el navegador Fragrantica no deja leer su web (CORS): en desarrollo pasa por aquí.
// En el móvil no hace falta: la app la descarga con la conexión nativa de Capacitor.
const fragrantica = (host) => ({
  target: `https://${host}`,
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/fragrantica-(es|com)/, ''),
});

// Service worker de la web instalable: guarda todos los archivos de la build para abrirla sin
// conexión. Su nombre de caché cambia con el contenido, así cada versión nueva sustituye a la anterior.
const SW = (version, files) => `const CACHE = 'fraganx-${version}';
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fraganx-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // La página, de la red si hay (para ver antes las versiones nuevas); el resto, de la caché
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
`;

const serviceWorker = () => {
  let outDir;
  return {
    name: 'fraganx-sw',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      const walk = (dir) => readdirSync(dir, { withFileTypes: true })
        .flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
      const paths = walk(outDir).filter((f) => !f.endsWith('sw.js')).sort();
      const hash = createHash('sha256');
      for (const f of paths) hash.update(readFileSync(f));
      const files = ['./', ...paths.map((f) => './' + relative(outDir, f).replaceAll('\\', '/'))];
      writeFileSync(join(outDir, 'sw.js'), SW(hash.digest('hex').slice(0, 12), files));
    },
  };
};

// base './' para que los assets carguen bien dentro del WebView de Capacitor (y en GitHub Pages)
export default defineConfig({
  plugins: [react(), serviceWorker()],
  base: './',
  server: {
    proxy: {
      '/fragrantica-es': fragrantica('www.fragrantica.es'),
      '/fragrantica-com': fragrantica('www.fragrantica.com'),
    },
  },
});
