// Familia de cada nota (bergamota → cítrico) para pintarla con el color y el icono de su acorde.
// Las notas vienen de Fragrantica en español o en inglés, o las escribe el usuario.

import { accordColor } from './constants.js';
import { mapAccord } from './fragrantica.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Se busca cada fragmento al principio de una palabra, en este orden: los más concretos van antes
// ("pimienta rosa" es especiado aunque lleve "rosa", "flor de naranjo" es floral aunque lleve "naranj").
const NOTE_MAP = [
  ['atalcado', ['iris', 'raiz de lirio', 'orris', 'talco', 'powder']],
  ['verde', ['hoja', 'leaf', 'leaves', 'te ', 'te verde', 'tea', 'hierba', 'grass', 'galbano', 'galbanum', 'verde', 'green',
    'bambu', 'bamboo', 'higuera', 'fig leaf', 'tomate', 'tomato', 'mate', 'pepino', 'cucumber']],
  ['especiado', ['pimient', 'pepper', 'canela', 'cinnamon', 'clavo', 'clove', 'cardamom', 'nuez moscada', 'nutmeg',
    'azafran', 'saffron', 'jengibre', 'ginger', 'comino', 'cumin', 'curcuma', 'turmeric', 'anis estrellado', 'star anise',
    'especias', 'spices', 'elemi']],
  ['floral', ['flor de', 'azahar', 'blossom', 'neroli', 'jazmin', 'jasmin', 'rosa', 'rose', 'peonia', 'peony', 'magnolia',
    'nardo', 'tuberos', 'gardenia', 'lirio', 'lily', 'muguet', 'ylang', 'geranio', 'geranium', 'pelargonio', 'freesia',
    'fresia', 'orquidea', 'orchid', 'heliotrop', 'osmanthus', 'mimosa', 'violeta', 'violet', 'champaca', 'frangipani', 'clavel', 'carnation']],
  ['cítrico', ['bergamot', 'limon', 'lemon', 'lima', 'lime', 'naranj', 'orange', 'mandarin', 'tangerin', 'pomelo',
    'toronja', 'grapefruit', 'yuzu', 'citron', 'cidra', 'petitgrain', 'clementin', 'kumquat', 'calamansi']],
  ['aromático', ['lavand', 'romero', 'rosemary', 'salvia', 'sage', 'menta', 'mint', 'albahaca', 'basil', 'tomillo', 'thyme',
    'artemis', 'ajenjo', 'wormwood', 'enebro', 'juniper', 'estragon', 'tarragon', 'anis', 'hinojo', 'fennel', 'eucalipt',
    'mejorana', 'marjoram', 'oregano', 'davana', 'cilantro', 'coriander']],
  ['acuático', ['marin', 'sea', 'mar ', 'sal', 'salt', 'agua', 'water', 'aquatic', 'acuatic', 'ozon', 'alga', 'calone',
    'lluvia', 'rain']],
  ['afrutado', ['manzana', 'apple', 'pera', 'pear', 'pina', 'pineapple', 'melocoton', 'peach', 'albaricoque', 'apricot',
    'frambuesa', 'raspberry', 'fresa', 'strawberr', 'grosella', 'currant', 'cassis', 'ciruela', 'plum', 'higo', 'fig',
    'mango', 'maracuya', 'passion', 'melon', 'sandia', 'watermelon', 'cereza', 'cherry', 'mora', 'blackberr', 'arandano',
    'blueberr', 'lichi', 'lychee', 'granada', 'pomegranate', 'uva', 'grape', 'frutos', 'berries', 'fruit', 'frut', 'coco',
    'coconut', 'datil', 'date', 'membrillo', 'quince', 'rhubarb', 'ruibarbo']],
  ['vainilla', ['vainilla', 'vanilla', 'vanill']],
  ['gourmand', ['haba tonka', 'tonka', 'cafe', 'coffee', 'cacao', 'cocoa', 'chocolat', 'caramel', 'praline', 'castana',
    'chestnut', 'almendra', 'almond', 'avellana', 'hazelnut', 'pistach', 'leche', 'milk', 'nata', 'cream', 'galleta',
    'biscuit', 'cookie', 'ron', 'rum', 'cognac', 'whisk', 'licor', 'liquor', 'azucar', 'sugar', 'algodon de azucar', 'regaliz', 'licorice']],
  ['dulce', ['miel', 'honey', 'dulce', 'sweet', 'malvavisco', 'marshmallow']],
  ['almizclado', ['almizcl', 'musk', 'aldehid', 'aldehyd', 'jabon', 'soap', 'algodon', 'cotton', 'ambreta', 'ambrette', 'ambar gris', 'ambergris']],
  ['ámbar', ['ambar', 'amber', 'benjui', 'benzoin', 'labdano', 'labdanum', 'ladano', 'mirra', 'myrrh', 'opopanax',
    'resina', 'resin', 'balsam', 'balsamo', 'tolu', 'peru', 'styrax', 'estoraque', 'copal', 'ambroxan', 'ambrox', 'cistus', 'jara']],
  ['ahumado', ['incienso', 'incense', 'olibano', 'olibanum', 'frankincense', 'tabaco', 'tobacco', 'humo', 'smoke', 'smok',
    'abedul', 'birch', 'cade', 'te negro', 'lapsang', 'brea', 'tar']],
  ['cuero', ['cuero', 'leather', 'gamuza', 'suede', 'ante', 'castoreo', 'castoreum', 'civet', 'algalia', 'animal']],
  ['terroso', ['pachul', 'patchoul', 'musgo', 'moss', 'silex', 'flint', 'mineral', 'tierra', 'earth', 'seta', 'mushroom', 'trufa', 'truffle']],
  ['oud', ['oud', 'agar']],
  ['amaderado', ['cedro', 'cedar', 'sandalo', 'sandalwood', 'vetiver', 'guayaco', 'guaiac', 'madera', 'wood', 'cachemir',
    'cashmere', 'cashmeran', 'pino', 'pine', 'abeto', 'fir', 'cipres', 'cypress', 'iso e', 'akigalawood', 'palo santo',
    'teca', 'teak', 'ebano', 'ebony', 'roble', 'oak', 'hinoki', 'raiz', 'root']],
];

// Para no recorrer la lista cada vez: fragmento → familia, con su expresión ya montada
const MATCHERS = NOTE_MAP.flatMap(([family, keys]) =>
  keys.map((k) => [new RegExp(`(^|[^a-z])${k.replace(/\s+$/, '(?:\\s|$)')}`), family]));

export function noteFamily(name) {
  const n = norm(name);
  const hit = MATCHERS.find(([re]) => re.test(n));
  return hit ? hit[1] : mapAccord(name);
}

export const FAMILY_EMOJI = {
  'cítrico': '🍋', 'acuático': '🌊', 'verde': '🍃', 'aromático': '🌿', 'afrutado': '🍑', 'floral': '🌸',
  'almizclado': '🫧', 'atalcado': '☁️', 'amaderado': '🪵', 'terroso': '🍂', 'especiado': '🌶️', 'dulce': '🍯',
  'cuero': '👞', 'ahumado': '💨', 'vainilla': '🍦', 'gourmand': '☕', 'ámbar': '🔶', 'oud': '🏺',
};

export const noteStyle = (name) => {
  const family = noteFamily(name);
  return { family, color: accordColor(family), emoji: FAMILY_EMOJI[family] || '•' };
};

// "Bergamota, pimienta rosa" → ['Bergamota', 'Pimienta rosa']
export const splitNotes = (s) =>
  (s || '').split(/,|;/).map((x) => x.trim()).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1));
