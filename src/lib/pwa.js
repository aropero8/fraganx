// Web instalable (iPhone: Safari → Compartir → Añadir a pantalla de inicio). El service worker
// (sw.js, lo genera vite.config.js) guarda la app para abrirla sin conexión. En Android no hace falta.

import { Capacitor } from '@capacitor/core';

export function setupPwa() {
  if (!import.meta.env.PROD || Capacitor.isNativePlatform()) return;

  // Que el navegador no borre la colección por falta de espacio (en iPhone, al instalarla ya no la borra)
  navigator.storage?.persist?.().catch(() => {});

  if (!('serviceWorker' in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin modo sin conexión */ });

  // Hay versión nueva: se recarga cuando no la estás mirando, para no cortarte a medias
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // primera instalación: ya es la versión actual
    if (document.hidden) return location.reload();
    document.addEventListener('visibilitychange', () => document.hidden && location.reload());
  });
}
