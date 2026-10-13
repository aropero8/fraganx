// Descarga la página de un perfume en Fragrantica y lee lo que viene en ella: nombre, marca,
// acordes (con su intensidad) y pirámide de notas. Fragrantica no tiene API y sus condiciones no
// permiten el acceso automático: la app solo pide la página de tus perfumes, de una en una y con
// pausas, como lo haría el navegador. Las votaciones (estaciones, día/noche, longevidad y estela)
// no van en la página: se cargan aparte y para ellas sigue estando el texto copiado (fragrantica.js).

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { mapAccord, parseFragrantica, parseFragranticaUrl } from './fragrantica.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// En el navegador (desarrollo) Fragrantica no deja leer su web por CORS: pasa por el proxy de Vite
const DEV_PROXY = { 'www.fragrantica.es': '/fragrantica-es', 'www.fragrantica.com': '/fragrantica-com' };

export async function fetchFragranticaPage(url) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers: { 'User-Agent': navigator.userAgent, 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
      responseType: 'text',
      connectTimeout: 15000,
      readTimeout: 20000,
    });
    if (res.status !== 200) throw new Error(`Fragrantica respondió ${res.status}`);
    return String(res.data);
  }
  const u = new URL(url);
  const prefix = DEV_PROXY[u.hostname.replace(/^fragrantica/, 'www.fragrantica')];
  if (!prefix) throw new Error('En el navegador solo se puede descargar de fragrantica.es o .com');
  const res = await fetch(prefix + u.pathname);
  if (!res.ok) throw new Error(`Fragrantica respondió ${res.status}`);
  return res.text();
}

// Acordes: barras bajo "acordes principales", con el ancho (intensidad) en su estilo
function readAccords(doc) {
  const heading = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6, b, strong, span, div')]
    .find((el) => /^(acordes principales|main accords)$/.test(norm(el.textContent)));
  if (!heading) return null;
  let box = heading.nextElementSibling;
  while (box && !box.querySelector('[style*="width"] span')) box = box.nextElementSibling;
  if (!box) return null;
  const named = [];
  const strengths = [];
  for (const bar of box.querySelectorAll('[style*="width"]')) {
    const name = clean(bar.querySelector('span')?.textContent).toLowerCase();
    const width = parseFloat(/width:\s*([\d.]+)%/.exec(bar.getAttribute('style'))?.[1]);
    if (!name || named.includes(name)) continue;
    named.push(name);
    strengths.push(Number.isFinite(width) ? Math.round(width) : null);
  }
  if (!named.length) return null;
  const accords = [...new Set(named.map(mapAccord).filter(Boolean))].slice(0, 5);
  return { accords, fragranticaAccords: named, accordStrengths: strengths };
}

// Pirámide: cada nivel con sus notas (el nombre está en la imagen y en la etiqueta)
function readPyramid(doc) {
  const names = (root) => [...root.querySelectorAll('a')]
    .map((a) => clean(a.querySelector('img')?.getAttribute('alt') || a.textContent))
    .filter(Boolean);
  const join = (list) => { const s = [...new Set(list)].join(', '); return s && s[0].toUpperCase() + s.slice(1); };
  const level = (key) => {
    const el = doc.querySelector(`pyramid-level-new[notes="${key}"]`);
    return el ? join(names(el)) : '';
  };
  const notes = { top: level('top'), heart: level('middle'), base: level('base') };
  if (notes.top || notes.heart || notes.base) return notes;
  // Sin niveles el perfume no tiene pirámide: todas sus notas van en salida
  const pyramid = doc.getElementById('pyramid');
  const flat = pyramid ? join(names(pyramid).filter((n) => !/^(mostrar|ocultar|show|hide) /i.test(n))) : '';
  return flat ? { top: flat, heart: '', base: '' } : null;
}

// Devuelve los campos que ha podido leer, como parseFragrantica, más accordStrengths
export function parseFragranticaHtml(html, url = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // La descripción ("X de Marca es una fragancia… Las Notas de Salida son…") da nombre, marca y,
  // si no hay pirámide, las notas
  const desc = clean(doc.querySelector('[itemprop="description"]')?.textContent);
  const out = { ...parseFragrantica(desc), ...(readAccords(doc) || {}) };
  const pyramid = readPyramid(doc);
  if (pyramid) out.notes = pyramid;
  const fromUrl = parseFragranticaUrl(url);
  if (fromUrl) {
    out.fragranticaUrl = fromUrl.url;
    out.name ||= fromUrl.name;
    out.brand ||= fromUrl.brand;
  }
  if (!out.accords && !out.notes) throw new Error('La página no trae acordes ni notas');
  return out;
}

export async function loadFromFragrantica(url) {
  return parseFragranticaHtml(await fetchFragranticaPage(url), url);
}

export const hasNotes = (p) => Boolean(p.notes?.top || p.notes?.heart || p.notes?.base);
export const needsFragrantica = (p) => Boolean(p.fragranticaUrl) && (!p.accords?.length || !hasNotes(p));

// Progreso de la tanda en curso ({ done, total, name } o null), para verlo aunque cambies de pantalla
let batch = null;
const listeners = new Set();
const setBatch = (b) => { batch = b; listeners.forEach((fn) => fn(b)); };
export function subscribeBatch(fn) {
  listeners.add(fn);
  fn(batch);
  return () => listeners.delete(fn);
}

// Completa varios perfumes seguidos, con una pausa entre uno y otro para no cargar a Fragrantica.
// Solo una tanda a la vez: si ya hay una, devuelve null.
export async function completeFromFragrantica(list, apply, { pause = 3000 } = {}) {
  if (batch || !list.length) return null;
  let ok = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      setBatch({ done: i, total: list.length, name: list[i].name });
      try {
        apply(list[i].id, await loadFromFragrantica(list[i].fragranticaUrl));
        ok++;
      } catch { /* se queda sin completar; se puede reintentar desde su ficha */ }
      if (i < list.length - 1) await sleep(pause);
    }
  } finally {
    setBatch(null);
  }
  return { ok, failed: list.length - ok };
}
