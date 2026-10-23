// Tu armario de Fragrantica. No se puede exportar y la lista llega cifrada, así que se lee de la página
// de tu perfil, ya abierta: en Android la app la abre en una ventana suya (FragranticaWardrobePlugin.java);
// en el navegador se usa un marcador que deja los enlaces en el formato de Ajustes → Importar.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { parseFragranticaUrl } from './fragrantica.js';

// Abre la pestaña Armario y devuelve [{ url, status, label }] cuando han cargado todos.
// Tiene que ser autónoma (no puede usar nada de fuera): se convierte en texto para inyectarla en la página.
async function collectWardrobe() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(300)) {
      const v = fn();
      if (v) return v;
    }
    return null;
  };
  const tab = await wait(() => [...document.querySelectorAll('[role=tab], button')]
    .find((t) => /^(armario|wardrobe)\s*\d*$/i.test(t.innerText.trim())), 20000);
  if (!tab) throw new Error('No encuentro el armario en esa página. ¿Es tu perfil de Fragrantica?');
  tab.click();

  // "Fragancias que tengo…", "…he tenido anteriormente", "…quiero tener…", "Quiero probarla"
  const statusOf = (h) => {
    const t = h.toLowerCase();
    if (/he tenido|\bhad\b/.test(t)) return 'tuve';
    if (/tengo|\bhave\b/.test(t)) return 'tengo';
    return 'quiero';
  };
  const rank = { tengo: 3, tuve: 2, quiero: 1 }; // si está en dos secciones, gana la primera
  const read = () => {
    const found = new Map();
    const sections = []; // cada una dice cuántos tiene: "Fragancias que tengo en mi colección 12"
    const panels = [...document.querySelectorAll('[role=tabpanel]')].filter((p) => p.offsetParent && p.querySelector('h4'));
    for (const panel of panels) {
      let section = null;
      for (const el of panel.querySelectorAll('h4, a[href*="/perfume/"]')) {
        if (el.tagName === 'H4') {
          section = { status: statusOf(el.innerText), expected: +(/(\d+)\s*$/.exec(el.innerText.trim())?.[1] || 0), links: 0, last: null };
          sections.push(section);
          continue;
        }
        if (!section) continue;
        section.links++;
        section.last = el;
        const url = el.href.split(/[?#]/)[0];
        const label = (el.querySelector('img')?.alt || '').replace(/^perfume\s+/i, '').trim();
        if (!found.has(url) || rank[section.status] > rank[found.get(url).status]) found.set(url, { url, status: section.status, label });
      }
    }
    const missing = sections.filter((s) => s.links < s.expected);
    return { items: [...found.values()], missing, done: sections.some((s) => s.links) && !missing.length };
  };
  await wait(() => read().items.length, 15000);
  // Fragrantica pinta cada sección por tandas (48 en móvil, 96 en ordenador) y pide la siguiente cuando
  // se ve el final: bajamos hasta el final de las que están a medias hasta que salen todos
  let r = read();
  for (let stuck = 0; !r.done && r.missing.length && stuck < 4;) {
    const before = r.items.length;
    for (const s of r.missing) {
      window.scrollBy(0, -window.innerHeight);
      await sleep(150);
      s.last?.scrollIntoView({ block: 'end' });
      await sleep(700);
    }
    r = read();
    stuck = r.items.length > before ? 0 : stuck + 1; // si deja de cargar más, nos quedamos con lo que hay
  }
  window.scrollTo(0, 0);
  const { items } = r;
  if (!items.length) throw new Error('No encuentro perfumes en tu armario. Puede que esté vacío o sea privado.');
  return items;
}

// Marcador para el navegador: muestra la lista con un botón para copiarla
function showWardrobe(collect) {
  collect().then((items) => {
    const text = items.map((p) => `${p.url};${p.status}`).join('\n');
    document.getElementById('perfumario-armario')?.remove();
    const box = document.createElement('div');
    box.id = 'perfumario-armario';
    box.style.cssText = 'position:fixed;inset:16px;z-index:2147483647;background:#fff;color:#111;border-radius:12px;'
      + 'box-shadow:0 8px 40px rgba(0,0,0,.4);padding:16px;display:flex;flex-direction:column;gap:10px;font:15px system-ui';
    box.innerHTML = `<b>${items.length} perfumes. Cópialos y pégalos en Ajustes → Importar.</b>`
      + '<textarea readonly style="flex:1;font:12px monospace;color:#111;background:#f4f4f4"></textarea>'
      + '<div style="display:flex;gap:8px"><button style="flex:1;padding:12px;font-size:16px">Copiar</button>'
      + '<button style="padding:12px;font-size:16px">Cerrar</button></div>';
    const [area] = box.getElementsByTagName('textarea');
    const [copy, close] = box.getElementsByTagName('button');
    area.value = text;
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(text); } catch { area.select(); document.execCommand('copy'); }
      copy.textContent = 'Copiado ✓';
    };
    close.onclick = () => box.remove();
    document.body.appendChild(box);
  }, (e) => alert(e.message));
}

export const WARDROBE_BOOKMARKLET = `javascript:${encodeURIComponent(`(${showWardrobe})(${collectWardrobe})`)}`;

// En Android la app abre tu perfil en su propia ventana y lo lee ella misma
export const canReadWardrobe = Capacitor.getPlatform() === 'android';
const Wardrobe = registerPlugin('FragranticaWardrobe');

// "erizopanzon", "@erizopanzon" o el enlace del perfil → enlace del perfil
export function profileUrl(input) {
  const s = (input || '').trim();
  if (/fragrantica\.[a-z.]+\//i.test(s)) return s.startsWith('http') ? s : `https://${s}`;
  const user = s.replace(/^@/, '');
  return /^[\w.-]+$/.test(user) ? `https://www.fragrantica.es/@${user}` : null;
}

// Nombre y marca de "Maison Alhambra Dark Door Sport": la marca es el principio que coincide con la del
// enlace (Maison-Alhambra). Así quedan bien "Collector's", "Zadig & Voltaire"… que el enlace no lleva.
function splitLabel(label, slugBrand) {
  const key = (s) => s.normalize('NFD').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const brandKey = key(slugBrand);
  for (let i = 1; i <= label.length; i++) {
    const k = key(label.slice(0, i));
    if (k.length > brandKey.length || !brandKey.startsWith(k)) break;
    if (k === brandKey && /\s/.test(label[i] || '')) return { brand: label.slice(0, i).trim(), name: label.slice(i).trim() };
  }
  return null;
}

// Abre tu perfil y devuelve tus perfumes listos para importar: [{ name, brand, fragranticaUrl, status }]
export async function readWardrobe(url) {
  const script = `if(!window.__perfumarioWardrobe){window.__perfumarioWardrobe=1;(${collectWardrobe})()`
    + '.then(r=>PerfumarioWardrobe.done(JSON.stringify(r)),e=>PerfumarioWardrobe.fail(e.message||String(e)))}';
  const { items } = await Wardrobe.read({ url, script });
  return items.map(({ url: link, status, label }) => {
    const p = parseFragranticaUrl(link);
    if (!p) return null;
    const named = label && splitLabel(label, p.brand);
    return { name: named?.name || p.name, brand: named?.brand || p.brand, fragranticaUrl: p.url, status };
  }).filter(Boolean);
}
