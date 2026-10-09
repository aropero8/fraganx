import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DEFAULT_SHAPE } from '../lib/constants.js';
import { buildBottle, buildBottleGeometry, shadowTexture } from '../lib/bottle3d.js';

// Estantería de madera con un frasco 3D por perfume. Tocar un frasco llama a onPick(perfume).
// Medidas en unidades de la escena: cada hueco mide 1 de ancho.
const SLOT = 1;
const BOTTLE_H = 0.84;
const ROW_H = 1.3;
const PLANK = 0.08;
const DEPTH = 0.8;
const FOV = 26;
const MAX_ROW_LIGHTS = 6; // cada luz encarece el render: con muchas baldas nos quedamos con la general

// Analizar una foto cuesta: guardamos el frasco de cada perfume mientras la app esté abierta.
// Para la estantería basta un modelo más ligero (uno de cada tres cortes).
const cache = new Map();
const keyOf = (p) => [p.id, p.image?.length, p.image?.slice(-48), p.backImage?.length, p.name, p.brand, p.accords.join()].join('|');

function getBottle(p) {
  const key = keyOf(p);
  if (!cache.has(key)) {
    const light = ({ profile, texture }) => {
      const last = profile.rings.length - 1;
      return { texture, profile: { ...profile, rings: profile.rings.filter((_, i) => i % 3 === 0 || i === last) } };
    };
    // Si la foto falla, frasco genérico
    cache.set(key, buildBottle(p).catch(() => buildBottle({ ...p, image: '' })).then(light));
  }
  return cache.get(key);
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a5a36';
  ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 128;
    const light = Math.random() < 0.5;
    ctx.strokeStyle = `rgba(${light ? '210,160,110' : '55,30,15'},${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.5 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 2.5);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Libera geometrías y materiales (no las texturas: son compartidas o están en caché)
function clearGroup(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) [].concat(o.material).forEach((m) => m.dispose());
  });
  group.clear();
}

const easeOut = (t) => 1 - (1 - t) ** 3;

export default function Shelf3D({ perfumes, onPick }) {
  const wrapRef = useRef(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [width, setWidth] = useState(0);
  const [labels, setLabels] = useState([]);
  const cols = Math.max(3, Math.min(6, Math.floor(width / 95)));

  useEffect(() => {
    const el = wrapRef.current;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escena, luces e interacción: se crean una vez
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
    scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xfff1dd, 1.1);
    key.position.set(1.5, 3, 5);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    const shelf = new THREE.Group();
    scene.add(shelf);
    const s = { renderer, camera, shelf, wood: woodTexture(), shadowTex: shadowTexture(), bottles: [], hovered: null, visible: true };
    sceneRef.current = s;

    // Qué frasco hay bajo el dedo o el ratón
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const ready = s.bottles.filter((b) => b.mesh);
      const hit = ray.intersectObjects(ready.map((b) => b.mesh), false)[0];
      return hit ? ready.find((b) => b.mesh === hit.object) : null;
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

    const clock = new THREE.Clock();
    let frame;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!s.visible) return;
      const t = clock.getElapsedTime();
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
    s.clock = clock;

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerleave', onLeave);
      c.removeEventListener('pointercancel', onLeave);
      clearGroup(shelf);
      s.wood.dispose(); s.shadowTex.dispose();
      env.dispose(); pmrem.dispose();
      renderer.dispose();
      el.removeChild(c);
      sceneRef.current = null;
    };
  }, []);

  // Mueble y frascos: se rehacen al cambiar la lista o el ancho
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !width) return;
    let alive = true;
    const { shelf, renderer, camera } = s;
    clearGroup(shelf);
    s.bottles = [];

    const n = perfumes.length;
    const rows = Math.max(1, Math.ceil(n / cols));
    const innerW = cols * SLOT + 0.2;
    const H = rows * ROW_H;
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      shelf.add(m);
      return m;
    };

    s.wood.repeat.set(cols / 2, 1);
    const woodMat = new THREE.MeshStandardMaterial({ map: s.wood, color: 0xc9a487, roughness: 0.65 });
    const backMat = new THREE.MeshStandardMaterial({ map: s.wood, color: 0x6b4a33, roughness: 0.85 });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
    for (let r = 0; r <= rows; r++) add(new THREE.BoxGeometry(innerW + 0.16, PLANK, DEPTH), woodMat, 0, r * ROW_H - PLANK / 2, 0);
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.08, H + PLANK, DEPTH), woodMat, side * (innerW / 2 + 0.04), H / 2 - PLANK / 2, 0);
    add(new THREE.PlaneGeometry(innerW, H), backMat, 0, H / 2, -DEPTH / 2);
    // Tira de luz bajo cada balda, como en una vitrina
    for (let r = 1; r <= rows; r++) {
      add(new THREE.BoxGeometry(innerW - 0.1, 0.012, 0.03), ledMat, 0, r * ROW_H - PLANK - 0.006, DEPTH / 2 - 0.08);
      if (rows <= MAX_ROW_LIGHTS) {
        const light = new THREE.PointLight(0xffd9a0, 2.2, 0, 2);
        light.position.set(0, r * ROW_H - PLANK - 0.1, DEPTH / 2 - 0.1);
        shelf.add(light);
      }
    }

    const now = s.clock.getElapsedTime();
    perfumes.forEach((p, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const x = ((i % cols) - (inRow - 1) / 2) * SLOT;
      const y = (rows - 1 - row) * ROW_H;

      const shadow = add(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: s.shadowTex, transparent: true, depthWrite: false }),
        x, y + 0.002, 0.02,
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.visible = false;

      const pivot = new THREE.Group();
      pivot.position.set(x, y + 0.6, 0.02);
      pivot.scale.setScalar(0.001);
      shelf.add(pivot);
      const entry = { perfume: p, pivot, base: y, phase: i * 1.7, lift: 0, spin: 0, start: Infinity, mesh: null, x, y };
      s.bottles.push(entry);

      getBottle(p).then(({ profile, texture }) => {
        if (!alive) return;
        const geometry = buildBottleGeometry(profile, p.shape || DEFAULT_SHAPE);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const size = box.getSize(new THREE.Vector3());
        const k = Math.min(BOTTLE_H / size.y, (SLOT * 0.8) / Math.max(size.x, size.z));
        const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
          map: texture, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
        }));
        mesh.scale.setScalar(k);
        mesh.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
        pivot.add(mesh);
        entry.mesh = mesh;
        entry.start = Math.max(s.clock.getElapsedTime(), now + i * 0.06);
        shadow.scale.set(size.x * k * 1.5, size.z * k * 1.5 + 0.15, 1);
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
    const slotPx = (width / boxW) * SLOT;
    wrapRef.current.style.setProperty('--slot', `${slotPx}px`);

    return () => { alive = false; };
  }, [perfumes, cols, width]);

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
