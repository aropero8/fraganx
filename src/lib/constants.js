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

// Sección del frasco para el modelo 3D: profundidad respecto al ancho y "cuadratura" (2 = elipse)
export const SHAPES = {
  plano: { label: 'Plano', depth: 0.45, n: 4 },
  redondo: { label: 'Redondo', depth: 1, n: 2 },
  cuadrado: { label: 'Cuadrado', depth: 1, n: 6 },
};
export const DEFAULT_SHAPE = 'plano';
