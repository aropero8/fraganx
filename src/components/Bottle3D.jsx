import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SHAPES, DEFAULT_SHAPE } from '../lib/constants.js';
import { buildBottle, buildBottleGeometry } from '../lib/bottle3d.js';
import { Icon } from './ui.jsx';

// Sombra suave bajo el frasco
function shadowTexture() {
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

export default function Bottle3D({ perfume, onShapeChange, onClose }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [bottle, setBottle] = useState(null);
  const [error, setError] = useState(false);
  const shape = perfume.shape || DEFAULT_SHAPE;

  // Analiza las fotos una vez
  useEffect(() => {
    let alive = true;
    setBottle(null);
    buildBottle(perfume).then((b) => alive && setBottle(b)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [perfume.image, perfume.backImage]);

  // Escena
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
    scene.add(new THREE.DirectionalLight(0xffffff, 1.2).translateX(2).translateY(3).translateZ(4));

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.3, 5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.5;
    controls.maxDistance = 9;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2;
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    const shadowTex = shadowTexture();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.01;
    scene.add(shadow);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let frame;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();

    sceneRef.current = { scene, shadow };
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      shadow.geometry.dispose(); shadow.material.dispose(); shadowTex.dispose();
      env.dispose(); pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Malla del frasco (se rehace al cambiar la forma)
  useEffect(() => {
    if (!bottle || !sceneRef.current) return;
    const { scene, shadow } = sceneRef.current;
    const geometry = buildBottleGeometry(bottle.profile, shape);
    const material = new THREE.MeshPhysicalMaterial({
      map: bottle.texture, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    shadow.scale.set(size.x * 1.6, size.z * 1.6 + 0.3, 1);
    return () => { scene.remove(mesh); geometry.dispose(); material.dispose(); };
  }, [bottle, shape]);

  useEffect(() => () => bottle?.texture.dispose(), [bottle]);

  return (
    <div className="viewer3d">
      <header className="topbar">
        <button className="link link--icon" onClick={onClose}><Icon name="back" size={20} /> Cerrar</button>
        <strong>{perfume.name}</strong>
        <span />
      </header>
      <div className="viewer3d__stage" ref={mountRef}>
        {!bottle && !error && <p className="viewer3d__msg muted">Creando modelo…</p>}
        {error && <p className="viewer3d__msg">No se pudo leer la foto.</p>}
      </div>
      <div className="viewer3d__bar">
        <div className="segmented segmented--small">
          {Object.entries(SHAPES).map(([k, s]) => (
            <button key={k} className={shape === k ? 'on' : ''} onClick={() => onShapeChange(k)}>{s.label}</button>
          ))}
        </div>
        <p className="muted small">
          Arrastra para girar, pellizca para acercar.
          {bottle?.profile.fallback && ' No distinguí bien el frasco del fondo: prueba con una foto de frente sobre un fondo liso.'}
          {!perfume.backImage && ' Añade una foto de detrás en Editar para que la espalda sea real.'}
        </p>
      </div>
    </div>
  );
}
