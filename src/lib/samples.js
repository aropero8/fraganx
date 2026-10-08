// Datos de ejemplo para probar la app. Se pueden borrar desde Ajustes.
export const SAMPLES = [
  {
    name: 'Acqua di Giò Profondo', brand: 'Giorgio Armani', status: 'tengo',
    accords: ['acuático', 'cítrico', 'aromático'], seasons: ['primavera', 'verano'],
    occasions: ['casual', 'trabajo', 'deporte'], intensity: 3, longevity: 3, rating: 4,
    notes: { top: 'Bergamota, mandarina verde', heart: 'Romero, lavanda, ciprés', base: 'Pachulí, almizcle' },
    comments: [{ id: 's1', date: '2026-07-10T09:00:00Z', text: 'Perfecto para el calor, muy limpio', sentiment: 1 }],
  },
  {
    name: "Terre d'Hermès", brand: 'Hermès', status: 'tengo',
    accords: ['cítrico', 'amaderado', 'terroso'], seasons: ['primavera', 'otoño'],
    occasions: ['trabajo', 'casual'], intensity: 3, longevity: 4, rating: 4.5,
    notes: { top: 'Naranja, pomelo', heart: 'Pimienta, pelargonio', base: 'Vetiver, cedro' },
    comments: [{ id: 's2', date: '2026-03-02T09:00:00Z', text: 'En la oficina siempre me dicen algo', sentiment: 1 }],
  },
  {
    name: 'Spicebomb', brand: 'Viktor&Rolf', status: 'tengo',
    accords: ['especiado', 'dulce', 'cuero'], seasons: ['otoño', 'invierno'],
    occasions: ['noche', 'cita'], intensity: 4, longevity: 4, rating: 4,
    notes: { top: 'Pimienta rosa, bergamota', heart: 'Canela, azafrán', base: 'Tabaco, cuero' },
    comments: [{ id: 's3', date: '2026-08-15T21:00:00Z', text: 'Con calor me empalaga muchísimo', sentiment: -1 }],
  },
  {
    name: 'By the Fireplace', brand: 'Maison Margiela', status: 'tengo',
    accords: ['ahumado', 'vainilla', 'amaderado'], seasons: ['invierno'],
    occasions: ['casual', 'cita'], intensity: 3, longevity: 3, rating: 4.5,
    notes: { top: 'Pimienta rosa, clavo', heart: 'Castaña, guayaco', base: 'Vainilla, cachemira' },
    comments: [{ id: 's4', date: '2026-01-20T18:00:00Z', text: 'Ideal en días de lluvia y frío', sentiment: 1 }],
  },
  {
    name: 'Baccarat Rouge 540', brand: 'Maison Francis Kurkdjian', status: 'quiero',
    accords: ['ámbar', 'amaderado', 'dulce'], seasons: ['otoño', 'invierno'],
    occasions: ['evento', 'noche'], intensity: 5, longevity: 5, rating: 0,
    notes: { top: 'Azafrán, jazmín', heart: 'Amberwood, ámbar gris', base: 'Resina de abeto, cedro' },
    comments: [{ id: 's5', date: '2026-09-01T12:00:00Z', text: 'Probarlo en piel antes de comprar, decant primero', sentiment: 0 }],
  },
  {
    name: 'Le Male', brand: 'Jean Paul Gaultier', status: 'tuve',
    accords: ['dulce', 'aromático', 'vainilla'], seasons: ['otoño', 'invierno'],
    occasions: ['noche'], intensity: 4, longevity: 4, rating: 3,
    leftReason: 'Lo regalé, me cansó', comments: [],
  },
];
