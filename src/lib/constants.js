export const STATUSES = {
  tengo: 'Los tengo',
  quiero: 'Los quiero',
  tuve: 'Los tuve',
};

// "Calidez" de cada acorde: -1 = muy fresco (va con calor), +1 = muy denso (va con frío)
export const ACCORDS = {
  'cítrico': -1,
  'acuático': -1,
  'verde': -0.7,
  'aromático': -0.4,
  'afrutado': -0.3,
  'floral': 0,
  'almizclado': 0,
  'atalcado': 0.2,
  'amaderado': 0.3,
  'terroso': 0.3,
  'especiado': 0.6,
  'dulce': 0.6,
  'cuero': 0.7,
  'ahumado': 0.8,
  'vainilla': 0.8,
  'gourmand': 0.9,
  'ámbar': 0.9,
  'oud': 1,
};

// Color de cada acorde, para etiquetas, barras y frascos sin foto
export const ACCORD_COLORS = {
  'cítrico': '#f2c94c',
  'acuático': '#4fb3d9',
  'verde': '#6fbf73',
  'aromático': '#8fae7a',
  'afrutado': '#f2836b',
  'floral': '#e98bb5',
  'almizclado': '#b9a6d6',
  'atalcado': '#e2c7d8',
  'amaderado': '#a9744f',
  'terroso': '#8f7d55',
  'especiado': '#d9622b',
  'dulce': '#e7a1a8',
  'cuero': '#8a5236',
  'ahumado': '#80848c',
  'vainilla': '#ecd39b',
  'gourmand': '#c0804f',
  'ámbar': '#e39b2f',
  'oud': '#6b4330',
};
export const accordColor = (a) => ACCORD_COLORS[a] || '#a8998b';

export const SEASONS = ['primavera', 'verano', 'otoño', 'invierno'];
export const SEASON_EMOJI = { primavera: '🌸', verano: '🌞', 'otoño': '🍂', invierno: '⛄' };
export const OCCASIONS = ['casual', 'trabajo', 'cita', 'noche', 'evento', 'deporte'];
export const OCCASION_EMOJI = { casual: '👕', trabajo: '💼', cita: '🌹', noche: '🌙', evento: '🥂', deporte: '🏃' };
export const CONDITIONS = ['calor', 'templado', 'frío', 'lluvia', 'humedad'];

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const CONDITION_EMOJI = {
  calor: '☀️', templado: '🌤️', 'frío': '❄️', lluvia: '🌧️', humedad: '💧',
};

// Forma del frasco hecho con fotos. El cuerpo y el tapón tienen cada uno su sección
// ("cuadratura" de una superelipse: 2 = círculo/elipse). El grosor sale de la foto de lado;
// sin ella, se elige a ojo respecto al ancho.
export const SECTIONS = {
  redondo: { label: 'Redondo', n: 2 },
  rectangular: { label: 'Rectangular', n: 5 },
};
export const THICKNESS = {
  plano: { label: 'Plano', depth: 0.45 },
  medio: { label: 'Medio', depth: 0.7 },
  grueso: { label: 'Grueso', depth: 1 },
};
export const DEFAULT_BOTTLE = { body: 'rectangular', cap: 'rectangular', thickness: 'plano' };

// Los perfumes guardados antes solo tenían "shape" (una sección para todo el frasco)
const LEGACY_SHAPES = {
  plano: DEFAULT_BOTTLE,
  redondo: { body: 'redondo', cap: 'redondo', thickness: 'grueso' },
  cuadrado: { body: 'rectangular', cap: 'rectangular', thickness: 'grueso' },
};
export const bottleShape = (p) => ({ ...DEFAULT_BOTTLE, ...LEGACY_SHAPES[p.shape], ...p.bottle });
