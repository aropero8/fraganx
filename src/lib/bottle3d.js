import * as THREE from 'three';
import { accordColor, DEFAULT_BOTTLE, SECTIONS, THICKNESS } from './constants.js';

// Construye un frasco 3D a partir de la foto de frente y, si las hay, las de lado y detrás.
// 1. Separa el frasco del fondo de cada foto (relleno desde los bordes por color parecido al de las esquinas).
// 2. Saca la silueta de cada una: la de frente da el ancho a cada altura y la de lado, el grosor.
// 3. Recorre esa silueta con la sección elegida para el tapón y el cuerpo (redonda o rectangular)
//    y pega cada foto en su lado del frasco.


const ANALYSIS_MAX = 320; // px del lado mayor para analizar la silueta
const RINGS = 140;        // cortes horizontales del modelo
const SEGMENTS = 48;      // puntos por media vuelta

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function pixels(img, max) {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

// Máscara del frasco: true = frasco, false = fondo
function foregroundMask({ w, h, data }) {
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);

  // Color de fondo = mediana de los bordes; tolerancia según lo uniforme que sea
  const ch = (k) => border.map((i) => data[i * 4 + k]).sort((a, b) => a - b)[border.length >> 1];
  const bg = [ch(0), ch(1), ch(2)];
  const dist = (i) => Math.hypot(data[i * 4] - bg[0], data[i * 4 + 1] - bg[1], data[i * 4 + 2] - bg[2]);
  const borderDists = border.map(dist).sort((a, b) => a - b);
  const tol = Math.min(80, Math.max(28, borderDists[Math.floor(border.length * 0.9)] * 1.6));

  const isBg = new Uint8Array(w * h);
  const stack = [];
  for (const i of border) if (dist(i) < tol) { isBg[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (const j of next) {
      if (j >= 0 && j < w * h && !isBg[j] && dist(j) < tol) { isBg[j] = 1; stack.push(j); }
    }
  }
  return isBg;
}

function median(arr, i, r) {
  const win = arr.slice(Math.max(0, i - r), i + r + 1).sort((a, b) => a - b);
  return win[win.length >> 1];
}

// Devuelve, para cada corte de arriba a abajo, el centro y medio ancho en fracción de la imagen.
export function extractProfile(img) {
  const px = pixels(img, ANALYSIS_MAX);
  const { w, h } = px;
  const isBg = foregroundMask(px);

  const rows = [];
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1, count = 0;
    for (let x = 0; x < w; x++) {
      if (!isBg[y * w + x]) { count++; if (l < 0) l = x; r = x; }
    }
    rows.push(count >= Math.max(2, w * 0.02) ? { l, r } : null);
  }

  // Tramo vertical más largo con frasco (tolerando huecos pequeños)
  let best = null, start = -1, gap = 0;
  for (let y = 0; y <= h; y++) {
    if (y < h && rows[y]) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0 && (y === h || ++gap > h * 0.03)) {
      const end = y - (y === h ? 1 : gap);
      if (!best || end - start > best[1] - best[0]) best = [start, end];
      start = -1; gap = 0;
    }
  }

  const area = rows.reduce((s, r) => s + (r ? r.r - r.l + 1 : 0), 0);
  const fallback = !best || best[1] - best[0] < h * 0.15 || area > w * h * 0.92;
  // Si no se distingue el frasco del fondo, usamos la foto entera como silueta
  const [y0, y1] = fallback ? [0, h - 1] : best;

  // Rellenamos huecos copiando el corte anterior
  let last = { l: 0, r: w - 1 };
  const filled = [];
  for (let y = y0; y <= y1; y++) {
    const row = fallback ? { l: 0, r: w - 1 } : rows[y] || last;
    filled.push(row);
    last = row;
  }

  const centers = [], halves = [];
  for (let k = 0; k < RINGS; k++) {
    const row = filled[Math.round((k / (RINGS - 1)) * (filled.length - 1))];
    centers.push((row.l + row.r + 1) / 2);
    halves.push((row.r - row.l + 1) / 2);
  }
  const smooth = (a) => a.map((_, i) => median(a, i, 3));
  const cx = smooth(centers), hw = smooth(halves);

  return {
    rings: cx.map((c, k) => ({
      v: (y0 + (k / (RINGS - 1)) * (y1 - y0 + 1)) / h, // altura en la foto (0 arriba, 1 abajo)
      cx: c / w,
      hw: hw[k] / w,
    })),
    aspect: w / h,
    fallback,
  };
}

// Textura con una franja por foto: frente, detrás en espejo y, si la hay, lado.
// layout dice dónde empieza (u0) y cuánto ocupa (w) cada franja, en fracción del ancho.
function makeTexture(front, back, side) {
  const H = Math.min(1024, front.height);
  const widthOf = (img) => Math.round((img.width / img.height) * H);
  const strips = [['front', front, false], ['back', back || front, true], ...(side ? [['side', side, false]] : [])];
  const total = strips.reduce((s, [, img]) => s + widthOf(img), 0);
  const c = document.createElement('canvas');
  c.width = total; c.height = H;
  const ctx = c.getContext('2d');
  const layout = {};
  let x = 0;
  for (const [key, img, mirror] of strips) {
    const w = widthOf(img);
    ctx.save();
    ctx.translate(mirror ? x + w : x, 0);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, H);
    ctx.restore();
    layout[key] = { u0: x / total, w: w / total };
    x += w;
  }
  if (!back) {
    // Sin foto trasera: la espalda es la delantera en espejo, algo más apagada
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(layout.back.u0 * total, 0, layout.back.w * total, H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { texture: tex, layout };
}

// Primer corte del cuerpo (los de encima son el tapón): el cuello, que es más estrecho que lo de
// encima y lo de debajo, o si no hay cuello, donde más se ensancha. Solo se busca en la mitad de
// arriba; 0 si no se ve un tapón claro.
function capEnd(widths) {
  const n = widths.length, lim = Math.round(n * 0.55);
  const above = [], below = [];
  for (let k = 0, m = 0; k < n; k++) above[k] = m = Math.max(m, widths[k]);
  for (let k = n - 1, m = 0; k >= 0; k--) below[k] = m = Math.max(m, widths[k]);
  const body = below[lim] || 1;

  let best = 0, score = 0.08;
  for (let k = 2; k < lim; k++) {
    const s = (Math.min(above[k], below[k]) - widths[k]) / body;
    if (s > score) { score = s; best = k; }
  }
  if (best) return best;

  const step = Math.max(2, Math.round(n * 0.02));
  score = 0.2;
  for (let k = step; k < lim - step; k++) {
    const s = (widths[k + step] - widths[k - step]) / body;
    if (s > score) { score = s; best = k; }
  }
  return best;
}

const spow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
const Q = Math.PI / 4;

// Trozos de la vuelta (t = 0 mira al frente, t = π/2 al lado derecho) y la foto de cada uno.
// Con foto de lado cada foto cubre su cuarto y las costuras caen en las esquinas;
// sin ella, frente y detrás se reparten la vuelta.
const PARTS_SIDE = [['front', -Q, Q], ['side', Q, 3 * Q], ['back', 3 * Q, 5 * Q], ['side', 5 * Q, 7 * Q]];
const PARTS_NO_SIDE = [['front', -2 * Q, 2 * Q], ['back', 2 * Q, 6 * Q]];

// Punto de cada foto que cae en el ángulo t de un corte (encogido un pelín para no coger fondo en el borde).
// La de detrás está en espejo, así que se lee como la de frente. En la de lado se supone el frente a la
// izquierda (foto hecha desde el lado derecho); el lado izquierdo del frasco la reutiliza.
const SAMPLE = {
  front: (r, t, e) => [r.cx + r.hw * 0.96 * spow(Math.sin(t), e), r.v],
  back: (r, t, e) => [r.back.cx + r.back.hw * 0.96 * spow(Math.sin(t), e), r.back.v],
  side: (r, t, e) => [r.side.cx - r.side.hw * 0.96 * spow(Math.cos(t), e), r.side.v],
};

export function buildBottleGeometry(profile, shape = DEFAULT_BOTTLE) {
  const { rings, aspect, layout } = profile;
  const hasSide = !!rings[0].side;
  const split = capEnd(rings.map((r) => r.hw));
  const sectionOf = (k) => SECTIONS[k < split ? shape.cap : shape.body] || SECTIONS.rectangular;
  const thickness = (THICKNESS[shape.thickness] || THICKNESS.plano).depth;

  // Unidades: el frasco mide 2 de alto. Cada foto se escala con su propia altura del frasco.
  const span = (key) => {
    const at = (r) => (key ? r[key] : r).v;
    return (at(rings[rings.length - 1]) - at(rings[0])) || 1;
  };
  const scale = 2 / span(), sideScale = hasSide ? 2 / span('side') : 0;
  const midX = rings.reduce((s, r) => s + r.cx, 0) / rings.length;
  const world = rings.map((r, k) => {
    const hw = r.hw * aspect * scale;
    const roundCap = k < split && shape.cap === 'redondo';
    return {
      y: (0.5 - (r.v - rings[0].v) / span()) * 2,
      x: (r.cx - midX) * aspect * scale,
      hw,
      depth: hasSide ? r.side.hw * profile.sideAspect * sideScale : hw * (roundCap ? 1 : thickness),
      e: 2 / sectionOf(k).n,
    };
  });

  const point = (k, t) => {
    const w = world[k];
    return new THREE.Vector3(w.x + w.hw * spow(Math.sin(t), w.e), w.y, w.depth * spow(Math.cos(t), w.e));
  };
  const uvOf = (key, k, t) => {
    const [x, v] = SAMPLE[key](rings[k], t, world[k].e);
    return [layout[key].u0 + x * layout[key].w, 1 - v];
  };

  const pos = [], nor = [], uv = [], idx = [];
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const steps = SEGMENTS / 2;

  // Cada trozo lleva vértices propios para que la textura no salte de una foto a otra
  for (const [key, from, to] of hasSide ? PARTS_SIDE : PARTS_NO_SIDE) {
    const base = pos.length / 3;
    const segs = Math.round((steps * (to - from)) / (2 * Q));
    for (let k = 0; k < rings.length; k++) {
      for (let j = 0; j <= segs; j++) {
        const t = from + ((to - from) * j) / segs;
        const p = point(k, t);
        pos.push(p.x, p.y, p.z);

        const dt = 1e-3;
        tmpA.subVectors(point(k, t + dt), point(k, t - dt));
        tmpB.subVectors(point(Math.max(0, k - 1), t), point(Math.min(rings.length - 1, k + 1), t));
        const n = new THREE.Vector3().crossVectors(tmpA, tmpB).normalize();
        if (!Number.isFinite(n.x) || n.lengthSq() === 0) n.set(Math.sin(t), 0, Math.cos(t));
        nor.push(n.x, n.y, n.z);
        uv.push(...uvOf(key, k, t));
      }
    }
    const row = segs + 1;
    for (let k = 0; k < rings.length - 1; k++) {
      for (let j = 0; j < segs; j++) {
        const a = base + k * row + j, b = a + row;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }

  // Tapas arriba y abajo, con el color de la foto de frente
  for (const [k, ny] of [[0, 1], [rings.length - 1, -1]]) {
    const w = world[k];
    const center = pos.length / 3;
    pos.push(w.x, w.y, 0); nor.push(0, ny, 0); uv.push(...uvOf('front', k, 0));
    const start = pos.length / 3;
    const around = SEGMENTS * 2;
    for (let j = 0; j <= around; j++) {
      const t = (j / around) * Math.PI * 2;
      const p = point(k, t);
      pos.push(p.x, p.y, p.z); nor.push(0, ny, 0);
      uv.push(...uvOf('front', k, t));
    }
    for (let j = 0; j < around; j++) {
      if (ny > 0) idx.push(center, start + j, start + j + 1);
      else idx.push(center, start + j + 1, start + j);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Frasco genérico para perfumes sin foto: silueta clásica (tapón, cuello, hombros, cuerpo)
// y una "foto" pintada con los colores de sus acordes y una etiqueta con el nombre.
const GENERIC_ASPECT = 0.62;

function genericHalfWidth(v) {
  if (v < 0.2) return 0.17;
  if (v < 0.25) return 0.09;
  if (v < 0.31) return 0.09 + 0.34 * Math.sin(((v - 0.25) / 0.06) * (Math.PI / 2));
  if (v > 0.97) return 0.43 - ((v - 0.97) / 0.03) * 0.04;
  return 0.43;
}

function genericProfile() {
  const rings = Array.from({ length: RINGS }, (_, k) => {
    const v = k / (RINGS - 1);
    return { v, cx: 0.5, hw: genericHalfWidth(v) };
  });
  return { rings, aspect: GENERIC_ASPECT, fallback: false, generic: true };
}

// Escribe el texto en una línea encogiendo la letra hasta que quepa (y si no, con puntos suspensivos)
function fitText(ctx, text, x, y, maxW, size, font) {
  let s = size;
  ctx.font = `${font} ${s}px Georgia, serif`;
  while (s > 14 && ctx.measureText(text).width > maxW) ctx.font = `${font} ${--s}px Georgia, serif`;
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + '…';
  ctx.fillText(t, x, y);
}

function genericPhoto({ name = '', brand = '', accords = [] }, withLabel) {
  const H = 512, W = Math.round(H * GENERIC_ASPECT);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const [a = '#d9a35f', b = a] = accords.slice(0, 2).map(accordColor);

  // Cristal con el color de los acordes y un reflejo vertical
  const body = ctx.createLinearGradient(0, H * 0.25, 0, H);
  body.addColorStop(0, a);
  body.addColorStop(1, b);
  ctx.fillStyle = body;
  ctx.fillRect(0, H * 0.22, W, H * 0.78);
  const shine = ctx.createLinearGradient(0, 0, W, 0);
  shine.addColorStop(0, 'rgba(0,0,0,0.18)');
  shine.addColorStop(0.3, 'rgba(255,255,255,0.28)');
  shine.addColorStop(0.4, 'rgba(255,255,255,0)');
  shine.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, H * 0.22, W, H * 0.78);

  // Tapón dorado y cuello
  const metal = ctx.createLinearGradient(0, 0, W, 0);
  metal.addColorStop(0, '#6b4f2a');
  metal.addColorStop(0.4, '#ecd29a');
  metal.addColorStop(1, '#5c4322');
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, W, H * 0.2);
  ctx.fillStyle = '#b8945a';
  ctx.fillRect(0, H * 0.2, W, H * 0.06);

  if (withLabel) {
    const lw = W * 0.56, lh = H * 0.24, lx = (W - lw) / 2, ly = H * 0.5;
    ctx.fillStyle = 'rgba(255,250,240,0.93)';
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, lh, 6);
    ctx.fill();
    ctx.fillStyle = '#2a1d14';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, name || '?', W / 2, ly + lh * 0.42, lw * 0.88, 30, 'bold');
    ctx.fillStyle = '#7a6250';
    fitText(ctx, brand.toUpperCase(), W / 2, ly + lh * 0.75, lw * 0.88, 16, '');
  }
  return c;
}

// Sombra suave bajo el frasco
export function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// La foto de detrás se pega en espejo, así que su centro también va en espejo. Si no se distingue
// el frasco en ella (o no hay), se supone encuadrada como la de frente.
function attachBack(profile, back) {
  profile.rings.forEach((r, k) => {
    const b = back && !back.fallback ? back.rings[k] : r;
    r.back = { v: b.v, cx: 1 - b.cx, hw: b.hw };
  });
}

export async function buildBottle(perfume) {
  const { image, backImage, sideImage } = perfume;
  if (!image) {
    const profile = genericProfile();
    attachBack(profile, null);
    const { texture, layout } = makeTexture(genericPhoto(perfume, true), genericPhoto(perfume, false));
    return { profile: { ...profile, layout }, texture };
  }
  const load = (src) => (src ? loadImage(src) : null);
  const [front, back, side] = await Promise.all([load(image), load(backImage), load(sideImage)]);
  const profile = extractProfile(front);
  attachBack(profile, back && extractProfile(back));

  // Cada corte de la foto de lado está a la misma altura relativa que el de la de frente
  const sideProfile = side && extractProfile(side);
  const sideOk = !!sideProfile && !sideProfile.fallback && !profile.fallback;
  if (sideOk) {
    profile.rings.forEach((r, k) => { r.side = sideProfile.rings[k]; });
    profile.sideAspect = sideProfile.aspect;
  }
  profile.sideFailed = !!side && !sideOk;

  const { texture, layout } = makeTexture(front, back, sideOk ? side : null);
  return { profile: { ...profile, layout }, texture };
}
