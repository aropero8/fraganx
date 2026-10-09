import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DEFAULT_SHAPE } from '../lib/constants.js';
import { buildBottle, buildBottleGeometry, shadowTexture } from '../lib/bottle3d.js';
import { fitModel, loadModel } from '../lib/model3d.js';
import { SHELF_BACKS, SHELF_LIGHTS, shelfStyle } from '../lib/shelfStyles.js';

// Estantería con un frasco 3D por perfume. Tocar un frasco llama a onPick(perfume).
// Medidas en unidades de la escena: cada hueco mide 1 de ancho.
const SLOT = 1;
const BOTTLE_H = 0.84;
const ROW_H = 1.3;
const PLANK = 0.08;
const DEPTH = 0.8;
const FOV = 26;
const MAX_ROW_LIGHTS = 6; // cada luz encarece el render: con muchas baldas nos quedamos con la general

// Analizar una foto o leer un modelo cuesta: guardamos el frasco de cada perfume mientras la app esté abierta.
// Para la estantería basta un frasco más ligero (uno de cada tres cortes).
const cache = new Map();
const keyOf = (p) => [p.id, p.modelKey, p.image?.length, p.image?.slice(-48), p.backImage?.length, p.name, p.brand, p.accords.join()].join('|');

function lathe(p) {
  return buildBottle(p)
    .catch(() => buildBottle({ ...p, image: '' })) // si la foto falla, frasco genérico
    .then(({ profile, texture }) => {
      const last = profile.rings.length - 1;
      return { texture, profile: { ...profile, rings: profile.rings.filter((_, i) => i % 3 === 0 || i === last) } };
    });
}

function getBottle(p) {
  const key = keyOf(p);
  if (!cache.has(key)) {
    // Si el modelo importado no está en este móvil (p. ej. tras restaurar una copia), frasco de fotos
    cache.set(key, p.modelKey ? loadModel(p.modelKey).then((model) => ({ model })).catch(() => lathe(p)) : lathe(p));
  }
  return cache.get(key);
}

// ---------- Texturas del mueble ----------

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Vetas: líneas onduladas claras y oscuras sobre el color base ("r,g,b" para poder darles transparencia)
const woodTexture = (base, light, dark) => canvasTexture(512, 128, (ctx, w, h) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? light : dark},${0.05 + Math.random() * 0.14})`;
    ctx.lineWidth = 0.5 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 2.5);
    ctx.stroke();
  }
});

const marbleTexture = () => canvasTexture(512, 256, (ctx, w, h) => {
  ctx.fillStyle = '#f1eee9';
  ctx.fillRect(0, 0, w, h);
  ctx.filter = 'blur(1px)';
  for (let i = 0; i < 16; i++) {
    let x = Math.random() * w, y = Math.random() * h;
    ctx.strokeStyle = `rgba(95,88,82,${0.3 + Math.random() * 0.4})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 40; k++) {
      x += 8 + Math.random() * 10;
      y += (Math.random() - 0.5) * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
});

const brushedTexture = (base) => canvasTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
});

const WOODS = {
  nogal: ['#6e4429', '190,140,95', '35,18,8', 0.6],
  roble: ['#c49563', '235,200,150', '110,72,40', 0.6],
  ebano: ['#2a1f1a', '95,75,62', '8,5,4', 0.4],
};

// Materiales del mueble: marco (laterales, techo y suelo), baldas y fondo
function cabinetMaterials(style, cols) {
  const textures = [];
  const tex = (t) => { t.repeat.set(cols / 2, 1); textures.push(t); return t; };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  let frame, plank, back;

  if (WOODS[style.material]) {
    const [base, light, dark, roughness] = WOODS[style.material];
    const map = tex(woodTexture(base, light, dark));
    frame = plank = std({ map, roughness });
    back = std({ map, color: 0x8a8a8a, roughness: 0.85 });
  } else if (style.material === 'blanco') {
    frame = plank = phys({ color: '#f1ece4', roughness: 0.35, clearcoat: 0.5 });
    back = std({ color: '#e2dbd0', roughness: 0.9 });
  } else if (style.material === 'marmol') {
    const map = tex(marbleTexture());
    frame = plank = phys({ map, roughness: 0.15, clearcoat: 0.6 });
    back = std({ map, color: 0xd2d2d2, roughness: 0.4 });
  } else if (style.material === 'metal') {
    frame = plank = std({ map: tex(brushedTexture('#b9bcc2')), metalness: 0.85, roughness: 0.35 });
    back = std({ color: '#2a2c30', roughness: 0.8 });
  } else {
    // Cristal: baldas de vidrio con marco de metal oscuro, como una vitrina
    frame = std({ map: tex(brushedTexture('#7d8188')), metalness: 0.9, roughness: 0.3 });
    plank = phys({ color: '#dff3f1', transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1 });
    back = std({ color: '#22272b', metalness: 0.3, roughness: 0.6 });
  }

  const color = SHELF_BACKS[style.back].color;
  if (color) {
    back.dispose();
    back = std({ color, roughness: 0.95 });
  }
  return {
    frame, plank, back,
    dispose() { [frame, plank, back].forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); },
  };
}

// Libera geometrías y materiales, salvo lo compartido (marcado con userData.keep) y las texturas
function clearGroup(group) {
  group.traverse((o) => {
    if (o.userData.keep) return;
    o.geometry?.dispose();
    if (o.material) [].concat(o.material).forEach((m) => m.dispose());
  });
  group.clear();
}

const easeOut = (t) => 1 - (1 - t) ** 3;

export default function Shelf3D({ perfumes, style, onPick }) {
  const wrapRef = useRef(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [width, setWidth] = useState(0);
  const [labels, setLabels] = useState([]);
  const cols = Math.max(3, Math.min(6, Math.floor(width / 95)));
  const rows = Math.max(1, Math.ceil(perfumes.length / cols));
  const st = shelfStyle(style);
  const styleKey = `${st.material}|${st.back}|${st.light}`;

  useEffect(() => {
    const el = wrapRef.current;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escena, cámara e interacción: se crean una vez
  useEffect(() => {
    const el = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    const key = new THREE.DirectionalLight(0xfff1dd, 1.1);
    key.position.set(1.5, 3, 5);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    const cabinet = new THREE.Group();
    const items = new THREE.Group();
    scene.add(cabinet, items);

    // Zona invisible de cada hueco para acertar al tocar, aunque el frasco sea fino o aún no esté
    const hitGeo = new THREE.CylinderGeometry(SLOT * 0.4, SLOT * 0.4, BOTTLE_H, 12).translate(0, BOTTLE_H / 2, 0);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    const s = {
      renderer, scene, camera, cabinet, items, hitGeo, hitMat,
      shadowTex: shadowTexture(), clock: new THREE.Clock(), bottles: [], hovered: null, visible: true,
    };
    sceneRef.current = s;

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(s.bottles.map((b) => b.hit), false)[0];
      return hit ? s.bottles.find((b) => b.hit === hit.object) : null;
    };

    // Un toque corto abre el frasco; si el dedo se mueve es que está haciendo scroll
    let down = null;
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e) => {
      if (!down) return;
      const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 500;
      down = null;
      const b = tap && pick(e);
      if (b) pickRef.current(b.perfume);
    };
    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      s.hovered = pick(e);
      renderer.domElement.style.cursor = s.hovered ? 'pointer' : '';
    };
    const onLeave = () => { s.hovered = null; down = null; };
    const c = renderer.domElement;
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerleave', onLeave);
    c.addEventListener('pointercancel', onLeave);

    // Sin dibujar mientras la estantería no se ve
    const io = new IntersectionObserver(([en]) => { s.visible = en.isIntersecting; });
    io.observe(el);

    let frame;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!s.visible) return;
      const t = s.clock.getElapsedTime();
      for (const b of s.bottles) {
        b.lift += ((s.hovered === b ? 1 : 0) - b.lift) * 0.15;
        b.spin += b.lift * 0.05;
        // Entrada: los frascos caen sobre la balda uno detrás de otro
        const appear = easeOut(Math.min(1, Math.max(0, (t - b.start) / 0.55)));
        b.pivot.position.y = b.base + (1 - appear) * 0.6 + b.lift * 0.05;
        b.pivot.scale.setScalar(0.6 + appear * 0.4);
        b.pivot.rotation.y = Math.sin(t * 0.45 + b.phase) * 0.4 + b.spin;
      }
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerleave', onLeave);
      c.removeEventListener('pointercancel', onLeave);
      clearGroup(items);
      clearGroup(cabinet);
      hitGeo.dispose(); hitMat.dispose(); s.shadowTex.dispose();
      env.dispose(); pmrem.dispose();
      renderer.dispose();
      el.removeChild(c);
      sceneRef.current = null;
    };
  }, []);

  // Mueble: se rehace al cambiar el número de huecos o el estilo
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const { cabinet, scene } = s;
    const innerW = cols * SLOT + 0.2;
    const H = rows * ROW_H;
    const mats = cabinetMaterials(st, cols);
    const lightColor = SHELF_LIGHTS[st.light].color;
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      cabinet.add(m);
      return m;
    };

    for (let r = 0; r <= rows; r++) {
      add(new THREE.BoxGeometry(innerW + 0.16, PLANK, DEPTH), r === 0 || r === rows ? mats.frame : mats.plank, 0, r * ROW_H - PLANK / 2, 0);
    }
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.08, H + PLANK, DEPTH), mats.frame, side * (innerW / 2 + 0.04), H / 2 - PLANK / 2, 0);
    add(new THREE.PlaneGeometry(innerW, H), mats.back, 0, H / 2, -DEPTH / 2);

    // Tira de luz bajo cada balda, como en una vitrina
    if (lightColor) {
      const ledMat = new THREE.MeshBasicMaterial({ color: lightColor });
      for (let r = 1; r <= rows; r++) {
        add(new THREE.BoxGeometry(innerW - 0.1, 0.012, 0.03), ledMat, 0, r * ROW_H - PLANK - 0.006, DEPTH / 2 - 0.08);
        if (rows <= MAX_ROW_LIGHTS) {
          const light = new THREE.PointLight(lightColor, 2.2, 0, 2);
          light.position.set(0, r * ROW_H - PLANK - 0.1, DEPTH / 2 - 0.1);
          cabinet.add(light);
        }
      }
    }
    scene.environmentIntensity = lightColor ? 0.55 : 0.85;

    return () => { clearGroup(cabinet); mats.dispose(); };
  }, [cols, rows, styleKey]);

  // Frascos, cámara y etiquetas: se rehacen al cambiar la lista o el ancho
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !width) return;
    let alive = true;
    const { items, renderer, camera } = s;
    clearGroup(items);
    s.bottles = [];

    const n = perfumes.length;
    const innerW = cols * SLOT + 0.2;
    const H = rows * ROW_H;
    const now = s.clock.getElapsedTime();

    perfumes.forEach((p, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const x = ((i % cols) - (inRow - 1) / 2) * SLOT;
      const y = (rows - 1 - row) * ROW_H;

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: s.shadowTex, transparent: true, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, y + 0.002, 0.02);
      shadow.visible = false;
      items.add(shadow);

      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0.02);
      const hit = new THREE.Mesh(s.hitGeo, s.hitMat);
      hit.userData.keep = true;
      pivot.add(hit);
      items.add(pivot);
      const entry = { perfume: p, pivot, hit, base: y, phase: i * 1.7, lift: 0, spin: 0, start: Infinity, x, y };
      s.bottles.push(entry);

      getBottle(p).then((b) => {
        if (!alive) return;
        let obj, size;
        if (b.model) {
          obj = fitModel(b.model, BOTTLE_H, SLOT * 0.8);
          size = obj.userData.size;
        } else {
          const geometry = buildBottleGeometry(b.profile, p.shape || DEFAULT_SHAPE);
          geometry.computeBoundingBox();
          const box = geometry.boundingBox;
          size = box.getSize(new THREE.Vector3());
          const k = Math.min(BOTTLE_H / size.y, (SLOT * 0.8) / Math.max(size.x, size.z));
          size.multiplyScalar(k);
          obj = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
            map: b.texture, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
          }));
          obj.scale.setScalar(k);
          obj.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
        }
        pivot.add(obj);
        entry.start = Math.max(s.clock.getElapsedTime(), now + i * 0.06);
        shadow.scale.set(size.x * 1.5, size.z * 1.5 + 0.15, 1);
        shadow.visible = true;
      });
    });

    // Lienzo con la proporción del mueble y cámara que lo encuadra entero
    const boxW = innerW + 0.3;
    const boxH = H + PLANK + 0.25;
    const height = Math.round((width * boxH) / boxW);
    mountRef.current.style.height = `${height}px`;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.position.set(0, H / 2 + 0.2, (boxH / 2 / Math.tan((FOV * Math.PI) / 360)) * 1.1 + DEPTH / 2);
    camera.lookAt(0, H / 2 - 0.05, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Etiquetas con el nombre en el canto de cada balda
    const v = new THREE.Vector3();
    setLabels(s.bottles.map((b) => {
      v.set(b.x, b.y - PLANK / 2, DEPTH / 2).project(camera);
      return { id: b.perfume.id, name: b.perfume.name, left: ((v.x + 1) / 2) * width, top: ((1 - v.y) / 2) * height };
    }));
    wrapRef.current.style.setProperty('--slot', `${(width / boxW) * SLOT}px`);

    return () => { alive = false; };
  }, [perfumes, cols, rows, width]);

  return (
    <div className="shelf" ref={wrapRef}>
      <div className="shelf__stage" ref={mountRef} />
      {labels.map((l) => (
        <button key={l.id} className="shelf__label" style={{ left: l.left, top: l.top }}
          onClick={() => onPick(perfumes.find((p) => p.id === l.id))}>
          {l.name}
        </button>
      ))}
    </div>
  );
}
