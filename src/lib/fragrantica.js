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

// Devuelve solo los campos que ha podido leer: { name, brand, accords, notes, seasons, occasions, fragranticaUrl }
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
    for (let i = ai + 1; i < lines.length && i < ai + 15; i++) {
      if (/buscar por acordes|search by accords/.test(nlines[i]) || nlines[i].length > 30) break;
      const a = mapAccord(lines[i]);
      if (a && !accords.includes(a)) accords.push(a);
    }
    if (accords.length) out.accords = accords.slice(0, 5);
  }

  // Notas, de la descripción ("Las Notas de Salida son …; las Notas de Corazón son …; las Notas de Fondo son …")
  const note = (re) => { const m = re.exec(text); return m ? tidyList(m[1]) : ''; };
  const top = note(/notas de salida son ([^;.]+)/i) || note(/top notes? (?:is|are) ([^;.]+)/i);
  const heart = note(/notas de coraz[oó]n son ([^;.]+)/i) || note(/middle notes? (?:is|are) ([^;.]+)/i);
  const base = note(/notas de fondo son ([^;.]+)/i) || note(/base notes? (?:is|are) ([^;.]+)/i);
  if (top || heart || base) out.notes = { top, heart, base };
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
  }

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
