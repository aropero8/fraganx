import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bottleShape } from '../lib/constants.js';
import { buildBottle, buildBottleGeometry, shadowTexture } from '../lib/bottle3d.js';
import { fitModel, loadModel } from '../lib/model3d.js';
import BottleShape from './BottleShape.jsx';
import { Icon } from './ui.jsx';

// Qué gana el modelo con cada foto que falta
const MISSING_PHOTOS = {
  side: ' Añade una foto de lado en Editar para que el grosor sea el real.',
  back: ' Añade una foto de detrás en Editar para que la espalda sea la real.',
  both: ' Añade fotos de lado y de detrás en Editar para que el grosor y la espalda sean los reales.',
};

export default function Bottle3D({ perfume, onBottleChange, onClose, onOpenDetail }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [bottle, setBottle] = useState(null);
  const [model, setModel] = useState(null);
  const [missing, setMissing] = useState(false); // tiene modelo importado pero no está en este móvil
  const [error, setError] = useState(false);
  const shape = bottleShape(perfume);
  const shapeKey = Object.values(shape).join();
  const missingPhotos = !perfume.sideImage && !perfume.backImage ? 'both' : !perfume.sideImage ? 'side' : !perfume.backImage ? 'back' : '';

  // Modelo importado o, si no hay, frasco hecho con las fotos (sin foto, pintado con el nombre y los acordes)
  useEffect(() => {
    let alive = true;
    setBottle(null); setModel(null); setMissing(false); setError(false);
    const photos = () => buildBottle(perfume).then((b) => alive && setBottle(b));
    const job = perfume.modelKey
      ? loadModel(perfume.modelKey).then((m) => alive && setModel(m)).catch(() => { if (alive) setMissing(true); return photos(); })
      : photos();
    job.catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [perfume.modelKey, perfume.image, perfume.sideImage, perfume.backImage, perfume.name, perfume.brand, perfume.accords.join()]);

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
  }, [bottle, shapeKey]);

  useEffect(() => () => bottle?.texture.dispose(), [bottle]);

  // Modelo importado: se comparte con la estantería, así que solo se quita de la escena
  useEffect(() => {
    if (!model || !sceneRef.current) return;
    const { scene, shadow } = sceneRef.current;
    const obj = fitModel(model, 2);
    obj.position.y = -1;
    scene.add(obj);
    const size = obj.userData.size;
    shadow.scale.set(size.x * 1.6, size.z * 1.6 + 0.3, 1);
    return () => { scene.remove(obj); };
  }, [model]);

  return (
    <div className="viewer3d">
      <header className="topbar">
        <button className="link link--icon" onClick={onClose}><Icon name="back" size={20} /> Cerrar</button>
        <strong>{perfume.name}</strong>
        {onOpenDetail ? <button className="link" onClick={onOpenDetail}>Ficha</button> : <span />}
      </header>
      <div className="viewer3d__stage" ref={mountRef}>
        {!bottle && !model && !error && <p className="viewer3d__msg muted">Creando modelo…</p>}
        {error && <p className="viewer3d__msg">No se pudo leer la foto.</p>}
      </div>
      <div className="viewer3d__bar">
        {!model && <BottleShape perfume={perfume} onChange={onBottleChange} thickness={bottle ? !bottle.profile.rings[0].side : !perfume.sideImage} />}
        <p className="muted small">
          Arrastra para girar, pellizca para acercar.
          {missing && ' El modelo 3D importado no está en este móvil (no viaja en las copias de seguridad): vuelve a importarlo en Editar.'}
          {bottle?.profile.fallback && ' No distinguí bien el frasco del fondo: prueba con una foto de frente sobre un fondo liso.'}
          {bottle?.profile.sideFailed && ' No distinguí el frasco en la foto de lado: prueba sobre un fondo liso, mientras tanto el grosor es el que elijas.'}
          {bottle && !perfume.image && ' Es un frasco genérico: añade una foto o importa un modelo 3D en Editar para ver el tuyo.'}
          {bottle && perfume.image && MISSING_PHOTOS[missingPhotos]}
        </p>
      </div>
    </div>
  );
}
