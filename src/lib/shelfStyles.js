// Opciones para personalizar la estantería de cada pestaña (material, fondo y luz).
// "swatch" es el CSS de la muestra que se ve en el selector.

export const SHELF_MATERIALS = {
  nogal: { label: 'Nogal', swatch: 'linear-gradient(135deg, #8a5a36, #5a3620)' },
  roble: { label: 'Roble', swatch: 'linear-gradient(135deg, #dcb07a, #a87a48)' },
  ebano: { label: 'Ébano', swatch: 'linear-gradient(135deg, #4a3a31, #17110e)' },
  blanco: { label: 'Lacado blanco', swatch: 'linear-gradient(135deg, #ffffff, #e2dbd0)' },
  marmol: { label: 'Mármol', swatch: 'linear-gradient(135deg, #f4f1ec 40%, #b9b2aa 50%, #f4f1ec 60%)' },
  metal: { label: 'Metal', swatch: 'linear-gradient(135deg, #e3e5e8, #8d9096)' },
  cristal: { label: 'Cristal', swatch: 'linear-gradient(135deg, #eef8f7, #9fc9c4)' },
};

export const SHELF_BACKS = {
  auto: { label: 'Como el mueble', color: null },
  crema: { label: 'Crema', color: '#e9dcc6' },
  salvia: { label: 'Salvia', color: '#8e9f86' },
  noche: { label: 'Azul noche', color: '#1f2a44' },
  burdeos: { label: 'Burdeos', color: '#5a1f2b' },
  terracota: { label: 'Terracota', color: '#b5643f' },
  rosa: { label: 'Rosa', color: '#d8a7a7' },
  negro: { label: 'Negro', color: '#141414' },
};

export const SHELF_LIGHTS = {
  calida: { label: 'Cálida', color: '#ffd9a0' },
  neutra: { label: 'Neutra', color: '#fff4e6' },
  fria: { label: 'Fría', color: '#d6e8ff' },
  rosa: { label: 'Rosa', color: '#ffb3c8' },
  apagada: { label: 'Apagada', color: null },
};

export const DEFAULT_SHELF = { material: 'nogal', back: 'auto', light: 'calida' };

// Completa lo que falte (o lo que ya no exista) con los valores por defecto
export function shelfStyle(s = {}) {
  return {
    material: SHELF_MATERIALS[s.material] ? s.material : DEFAULT_SHELF.material,
    back: SHELF_BACKS[s.back] ? s.back : DEFAULT_SHELF.back,
    light: SHELF_LIGHTS[s.light] ? s.light : DEFAULT_SHELF.light,
  };
}
