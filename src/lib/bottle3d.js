import * as THREE from 'three';
import { SHAPES, DEFAULT_SHAPE } from './constants.js';

// Construye un frasco 3D a partir de la foto de frente (y opcionalmente la de detrás).
// 1. Separa el frasco del fondo (relleno desde los bordes por color parecido al de las esquinas).
// 2. Saca la silueta: el ancho del frasco en cada altura.
// 3. Gira esa silueta con la sección elegida (redonda, plana o cuadrada) y le pega las fotos encima.


const ANALYSIS_MAX = 320; // px del lado mayor para analizar la silueta
const RINGS = 140;        // cortes horizontales del modelo
const SEGMENTS = 48;      // puntos por media vuelta (delante / detrás)

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

// Textura combinada: mitad izquierda la foto de frente, mitad derecha la de detrás en espejo.
function makeTexture(front, back) {
  const H = Math.min(1024, front.height);
  const W = Math.round((front.width / front.height) * H);
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(front, 0, 0, W, H);
  ctx.save();
  ctx.translate(W * 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(back || front, 0, 0, W, H);
  ctx.restore();
  if (!back) {
    // Sin foto trasera: la espalda es la delantera en espejo, algo más apagada
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(W, 0, W, H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const spow = (v, e) => Math.sign(v) * Math.abs(v) ** e;

export function buildBottleGeometry(profile, shapeKey = DEFAULT_SHAPE) {
  const shape = SHAPES[shapeKey] || SHAPES[DEFAULT_SHAPE];
  const { rings, aspect } = profile;
  const e = 2 / shape.n;
  // Unidades: el frasco mide 2 de alto
  const vTop = rings[0].v, vBot = rings[rings.length - 1].v;
  const scale = 2 / ((vBot - vTop) || 1);
  const midX = rings.reduce((s, r) => s + r.cx, 0) / rings.length;
  const toWorld = (r) => ({
    y: (0.5 - (r.v - vTop) / (vBot - vTop)) * 2,
    x: ((r.cx - midX) * aspect) * scale,
    hw: r.hw * aspect * scale,
  });

  const point = (k, t) => {
    const r = toWorld(rings[k]);
    return new THREE.Vector3(r.x + r.hw * spow(Math.sin(t), e), r.y, r.hw * shape.depth * spow(Math.cos(t), e));
  };

  const pos = [], nor = [], uv = [], idx = [];
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  // Dos mitades con vértices propios para que la textura no salte de una foto a otra
  for (const half of [0, 1]) {
    const base = pos.length / 3;
    for (let k = 0; k < rings.length; k++) {
      for (let j = 0; j <= SEGMENTS; j++) {
        const t = -Math.PI / 2 + Math.PI * (j / SEGMENTS) + half * Math.PI;
        const p = point(k, t);
        pos.push(p.x, p.y, p.z);

        const dt = 1e-3;
        tmpA.subVectors(point(k, t + dt), point(k, t - dt));
        tmpB.subVectors(point(Math.max(0, k - 1), t), point(Math.min(rings.length - 1, k + 1), t));
        const n = new THREE.Vector3().crossVectors(tmpA, tmpB).normalize();
        if (!Number.isFinite(n.x) || n.lengthSq() === 0) n.set(Math.sin(t), 0, Math.cos(t));
        nor.push(n.x, n.y, n.z);

        // Posición horizontal en la foto (encogida un pelín para no coger fondo en el borde)
        const r = rings[k];
        const s = Math.sin(t);
        const imgX = r.cx + r.hw * 0.96 * spow(s, e);
        uv.push(half === 0 ? imgX * 0.5 : 0.5 + imgX * 0.5, 1 - r.v);
      }
    }
    const row = SEGMENTS + 1;
    for (let k = 0; k < rings.length - 1; k++) {
      for (let j = 0; j < SEGMENTS; j++) {
        const a = base + k * row + j, b = a + row;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }

  // Tapas arriba y abajo
  for (const [k, ny] of [[0, 1], [rings.length - 1, -1]]) {
    const r = toWorld(rings[k]);
    const center = pos.length / 3;
    pos.push(r.x, r.y, 0); nor.push(0, ny, 0); uv.push(rings[k].cx * 0.5, 1 - rings[k].v);
    const start = pos.length / 3;
    const steps = SEGMENTS * 2;
    for (let j = 0; j <= steps; j++) {
      const t = (j / steps) * Math.PI * 2;
      const p = point(k, t);
      pos.push(p.x, p.y, p.z); nor.push(0, ny, 0);
      uv.push((rings[k].cx + rings[k].hw * 0.9 * spow(Math.sin(t), e)) * 0.5, 1 - rings[k].v);
    }
    for (let j = 0; j < steps; j++) {
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

export async function buildBottle({ image, backImage }) {
  const [front, back] = await Promise.all([loadImage(image), backImage ? loadImage(backImage) : null]);
  return { profile: extractProfile(front), texture: makeTexture(front, back) };
}
