// Lee los datos de un perfume a partir de lo que el usuario copia de Fragrantica.
// No descargamos nada: Fragrantica no tiene API, bloquea las peticiones automáticas y sus
// condiciones no permiten scraping. El usuario abre la ficha, selecciona todo, copia y lo pega aquí.
// Entiende la web en español (fragrantica.es) y en inglés (fragrantica.com).

import { ACCORDS } from './constants.js';

const URL_RE = /https?:\/\/(?:www\.)?fragrantica\.[a-z.]+\/(?:perfume|perfumes)\/([^/\s]+)\/([^/\s?#]+?)-\d+\.html/i;

// Sin tildes, minúsculas: para comparar textos de la web con los nuestros
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const unslug = (s) => decodeURIComponent(s).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

// Acorde de Fragrantica (es/en) → acorde de la app. Se busca el primer fragmento contenido en el nombre.
const ACCORD_MAP = [
  ['especiado', 'especiado'], ['spicy', 'especiado'], ['canela', 'especiado'], ['cinnamon', 'especiado'],
  ['citric', 'cítrico'], ['citrus', 'cítrico'], ['acido', 'cítrico'], ['sour', 'cítrico'],
  ['acuatic', 'acuático'], ['aquatic', 'acuático'], ['marin', 'acuático'], ['ozon', 'acuático'], ['salad', 'acuático'], ['salty', 'acuático'],
  ['verde', 'verde'], ['green', 'verde'], ['herbal', 'verde'],
  ['aromatic', 'aromático'], ['lavand', 'aromático'], ['anis', 'aromático'], ['fresco', 'aromático'], ['fresh', 'aromático'],
  ['frut', 'afrutado'], ['fruit', 'afrutado'], ['tropical', 'afrutado'], ['cereza', 'afrutado'], ['cherry', 'afrutado'], ['coco', 'afrutado'],
  ['floral', 'floral'], ['rosa', 'floral'], ['rose', 'floral'], ['tuberos', 'floral'], ['iris', 'floral'], ['violet', 'floral'],
  ['almizcl', 'almizclado'], ['musk', 'almizclado'], ['jabon', 'almizclado'], ['soapy', 'almizclado'], ['aldehid', 'almizclado'], ['aldehyd', 'almizclado'],
  ['atalcad', 'atalcado'], ['powder', 'atalcado'], ['cosmetic', 'atalcado'],
  ['amaderad', 'amaderado'], ['wood', 'amaderado'],
  ['terros', 'terroso'], ['earth', 'terroso'], ['musgo', 'terroso'], ['moss', 'terroso'], ['pachul', 'terroso'], ['patchoul', 'terroso'], ['mineral', 'terroso'],
  ['vainill', 'vainilla'], ['vanill', 'vainilla'],
  ['dulce', 'dulce'], ['sweet', 'dulce'], ['miel', 'dulce'], ['honey', 'dulce'],
  ['cuero', 'cuero'], ['leather', 'cuero'], ['animal', 'cuero'],
  ['ahumad', 'ahumado'], ['smok', 'ahumado'], ['tabaco', 'ahumado'], ['tobacco', 'ahumado'], ['incienso', 'ahumado'], ['incense', 'ahumado'],
  ['gourmand', 'gourmand'], ['caramel', 'gourmand'], ['chocolat', 'gourmand'], ['cacao', 'gourmand'], ['cafe', 'gourmand'], ['coffee', 'gourmand'],
  ['avellan', 'gourmand'], ['nut', 'gourmand'], ['almendr', 'gourmand'], ['almond', 'gourmand'], ['lacton', 'gourmand'], ['ron', 'gourmand'], ['rum', 'gourmand'],
  ['ambar', 'ámbar'], ['amber', 'ámbar'], ['balsam', 'ámbar'], ['resin', 'ámbar'],
  ['oud', 'oud'],
];

export function mapAccord(name) {
  const n = norm(name);
  if (ACCORDS[n] !== undefined) return n;
  const hit = ACCORD_MAP.find(([k]) => n.includes(k));
  return hit ? hit[1] : null;
}

// "15.8k" → 15800, "1,234" → 1234
const votes = (s) => {
  const m = /^([\d.,]+)\s*(k)?$/i.exec(s.trim());
  if (!m) return null;
  const n = m[2] ? parseFloat(m[1].replace(',', '.')) * 1000 : parseInt(m[1].replace(/[.,]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

// Une "a, b y c" / "a, b and c" en "A, b, c"
const tidyList = (s) => {
  const items = s.split(/,|\s+y\s+|\s+and\s+/i).map((x) => x.trim()).filter(Boolean);
  const out = items.join(', ');
  return out ? out[0].toUpperCase() + out.slice(1) : '';
};

const SEASON_WORDS = {
  primavera: 'primavera', spring: 'primavera',
  verano: 'verano', summer: 'verano',
  otono: 'otoño', fall: 'otoño', autumn: 'otoño',
  invierno: 'invierno', winter: 'invierno',
};

export function parseFragranticaUrl(text) {
  const m = URL_RE.exec(text || '');
  if (!m) return null;
  return { url: m[0], brand: unslug(m[1]), name: unslug(m[2]) };
}

// Notas de la sección "Pirámide del perfume": cada nota en su línea, bajo su encabezado.
// Es más completa que la descripción, que a veces se deja alguna.
const PYRAMID_START = /^(piramide del perfume|perfume pyramid|fragrance notes)$/;
const PYRAMID_END = /^(votar por ingredientes|vote for ingredients)/;
const PYRAMID_SKIP = /^(mostrar|ocultar|show|hide) /;
const PYRAMID_HEADINGS = [
  [/^(notas de salida|salida|top notes?)$/, 'top'],
  [/^(notas de corazon|corazon|middle notes?|heart notes?)$/, 'heart'],
  [/^(notas de fondo|fondo|base|base notes?)$/, 'base'],
];

function parsePyramid(lines, nlines) {
  const start = nlines.findIndex((l) => PYRAMID_START.test(l));
  if (start < 0) return null;
  const groups = { top: [], heart: [], base: [] };
  let group = 'top'; // sin encabezados el perfume no tiene pirámide: todo va en salida
  for (let i = start + 1; i < lines.length && i < start + 80; i++) {
    const l = nlines[i];
    if (PYRAMID_END.test(l)) break;
    if (PYRAMID_SKIP.test(l) || /^[\d.,\s%k]+$/.test(l)) continue; // botones y votos
    const heading = PYRAMID_HEADINGS.find(([re]) => re.test(l));
    if (heading) { group = heading[1]; continue; }
    if (l.length > 40) break;
    if (!groups[group].some((n) => norm(n) === l)) groups[group].push(lines[i]);
  }
  const join = (list) => { const s = list.join(', '); return s && s[0].toUpperCase() + s.slice(1); };
  const notes = { top: join(groups.top), heart: join(groups.heart), base: join(groups.base) };
  return notes.top || notes.heart || notes.base ? notes : null;
}

// Devuelve solo los campos que ha podido leer:
// { name, brand, accords, fragranticaAccords, notes, seasons, occasions, daytime,
//   community: { longevity: [5 votos], sillage: [4 votos] }, longevity, intensity, fragranticaUrl }
export function parseFragrantica(text) {
  const out = {};
  if (!text?.trim()) return out;

  const fromUrl = parseFragranticaUrl(text);
  if (fromUrl) Object.assign(out, { name: fromUrl.name, brand: fromUrl.brand, fragranticaUrl: fromUrl.url });

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nlines = lines.map(norm);

  // Nombre y marca, de la descripción: "X de Marca es una fragancia" / "X by Brand is a ... fragrance"
  // El nombre puede llevar " de " (Eau de Rhubarbe…): probamos cada corte y preferimos el que deja
  // como marca algo que aparece solo en una línea (la página pone la marca debajo del título).
  const desc = /(?:^|\n)\s*(.+?)\s+(?:es una fragancia|is an? .*?fragrance)/i.exec(text);
  if (desc) {
    const s = desc[1];
    const cuts = [...s.matchAll(/\s+(?:de|by)\s+/gi)].map((m) => [s.slice(0, m.index), s.slice(m.index + m[0].length)]);
    const [name, brand] = cuts.find(([, b]) => nlines.includes(norm(b))) || cuts[cuts.length - 1] || [];
    if (name) { out.name = name.trim(); out.brand = brand.trim(); }
  }

  // Acordes: líneas tras "acordes principales" / "main accords"
  const ai = nlines.findIndex((l) => l === 'acordes principales' || l === 'main accords');
  if (ai >= 0) {
    const accords = [];
    const named = []; // tal cual los llama Fragrantica ("fresco especiado"), de más a menos intenso
    for (let i = ai + 1; i < lines.length && i < ai + 15; i++) {
      if (/buscar por acordes|search by accords/.test(nlines[i]) || nlines[i].length > 30) break;
      const a = mapAccord(lines[i]);
      if (!a) continue;
      if (!accords.includes(a)) accords.push(a);
      named.push(lines[i].toLowerCase());
    }
    if (accords.length) out.accords = accords.slice(0, 5);
    if (named.length) out.fragranticaAccords = named;
  }

  // Notas: de la pirámide o, si no está, de la descripción
  // ("Las Notas de Salida son …; las Notas de Corazón son …; las Notas de Fondo son …")
  const note = (re) => { const m = re.exec(text); return m ? tidyList(m[1]) : ''; };
  const top = note(/notas de salida son ([^;.]+)/i) || note(/top notes? (?:is|are) ([^;.]+)/i);
  const heart = note(/notas de coraz[oó]n son ([^;.]+)/i) || note(/middle notes? (?:is|are) ([^;.]+)/i);
  const base = note(/notas de fondo son ([^;.]+)/i) || note(/base notes? (?:is|are) ([^;.]+)/i);
  const pyramid = parsePyramid(lines, nlines);
  if (pyramid) out.notes = pyramid;
  else if (top || heart || base) out.notes = { top, heart, base };
  else {
    // Perfumes sin pirámide: "Las notas son a, b y c" → todo en salida
    const flat = note(/las notas son ([^;.]+)/i) || note(/(?:fragrance|perfume) notes? (?:is|are) ([^;.]+)/i);
    if (flat) out.notes = { top: flat, heart: '', base: '' };
  }

  // Cuándo usarlo: palabra seguida de su número de votos
  const when = {};
  for (let i = 0; i < nlines.length - 1; i++) {
    const w = nlines[i];
    const v = votes(lines[i + 1]);
    if (v === null) continue;
    if (SEASON_WORDS[w] && when[SEASON_WORDS[w]] === undefined) when[SEASON_WORDS[w]] = v;
    else if ((w === 'dia' || w === 'day') && when.dia === undefined) when.dia = v;
    else if ((w === 'noche' || w === 'night') && when.noche === undefined) when.noche = v;
  }
  const seasonVotes = Object.entries(when).filter(([k]) => !['dia', 'noche'].includes(k));
  if (seasonVotes.length) {
    const max = Math.max(...seasonVotes.map(([, v]) => v));
    // Las estaciones con al menos el 60 % de los votos de la más votada
    out.seasons = ['primavera', 'verano', 'otoño', 'invierno'].filter((s) => when[s] >= max * 0.6);
  }
  if (when.dia !== undefined && when.noche !== undefined) {
    const occ = [];
    if (when.dia >= when.noche * 0.7) occ.push('casual', 'trabajo');
    if (when.noche >= when.dia * 0.7) occ.push('noche');
    out.occasions = occ;
    // Parte de los votos que son de noche → 1 (muy de día) … 5 (muy de noche)
    const total = when.dia + when.noche;
    if (total > 0) {
      const night = when.noche / total;
      out.daytime = night < 0.3 ? 1 : night < 0.43 ? 2 : night <= 0.57 ? 3 : night <= 0.7 ? 4 : 5;
    }
  }

  // Rendimiento: votos de longevidad y estela. Fragrantica carga esta parte al bajar hasta ella,
  // así que solo viene si se ha llegado al final de la página antes de copiar.
  const longevity = sectionVotes(nlines, lines, PERFORMANCE.longevity);
  const sillage = sectionVotes(nlines, lines, PERFORMANCE.sillage);
  if (longevity || sillage) {
    out.community = {};
    if (longevity) {
      out.community.longevity = longevity;
      out.longevity = Math.round(average(longevity));
    }
    if (sillage) {
      out.community.sillage = sillage;
      // Estela 1-4 → proyección 1-5 de la app
      out.intensity = Math.round(1 + (average(sillage) - 1) * 4 / 3);
    }
  }

  return out;
}

// Opciones de cada votación, de menos a más, en español e inglés (sin tildes)
const PERFORMANCE = {
  longevity: {
    start: /^(longevidad|longevity)$/,
    options: [['escasa', 'very weak'], ['debil', 'weak'], ['moderada', 'moderate'], ['duradera', 'long lasting'], ['muy duradera', 'eternal']],
  },
  sillage: {
    start: /^(estela de la fragancia|estela|sillage)$/,
    options: [['suave', 'intimate'], ['moderada', 'moderate'], ['pesada', 'strong'], ['enorme', 'enormous']],
  },
};
const PERFORMANCE_STARTS = Object.values(PERFORMANCE).map((s) => s.start);

// Votos de una sección ("moderada" está en las dos: se busca solo dentro de la suya)
function sectionVotes(nlines, lines, { start, options }) {
  const s = nlines.findIndex((l) => start.test(l));
  if (s < 0) return null;
  const out = options.map(() => null);
  for (let i = s + 1; i < lines.length - 1 && i < s + 16; i++) {
    if (PERFORMANCE_STARTS.some((re) => re.test(nlines[i]))) break;
    const k = options.findIndex((o) => o.includes(nlines[i]));
    if (k < 0 || out[k] !== null) continue;
    const v = votes(lines[i + 1]);
    if (v !== null) out[k] = v;
  }
  const filled = out.map((v) => v ?? 0);
  return filled.some((v) => v > 0) ? filled : null;
}

// Media de una votación con opciones 1, 2, 3…
const average = (list) => list.reduce((s, v, i) => s + v * (i + 1), 0) / list.reduce((s, v) => s + v, 0);

// Al completar un perfume ya guardado: lo que viene de Fragrantica se actualiza, pero lo que
// es tuyo (nombre, enlace, estaciones, ocasiones, día/noche) solo se rellena si estaba vacío
export function mergeFragrantica(p, data) {
  const out = { ...p, ...data };
  if (data.accords && !data.fragranticaAccords) out.fragranticaAccords = [];
  for (const k of ['name', 'brand', 'fragranticaUrl', 'daytime']) if (p[k]) out[k] = p[k];
  for (const k of ['seasons', 'occasions']) if (p[k]?.length) out[k] = p[k];
  return out;
}

// Para la importación en bloque: líneas "enlace" o "enlace;estado"
export function parseFragranticaUrlList(text) {
  const statusMap = { tengo: 'tengo', have: 'tengo', quiero: 'quiero', want: 'quiero', tuve: 'tuve', had: 'tuve' };
  return text.split(/\r?\n/).map((line) => {
    const p = parseFragranticaUrl(line);
    if (!p) return null;
    const status = statusMap[norm(line.slice(line.indexOf(p.url) + p.url.length).replace(/^[\s;,]+/, ''))] || 'tengo';
    return { name: p.name, brand: p.brand, fragranticaUrl: p.url, status };
  }).filter(Boolean);
}
