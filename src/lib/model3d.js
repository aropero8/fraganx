import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getModel } from './modelStore.js';

// Carga los modelos .glb importados. Admite modelos comprimidos con Draco (el decodificador está
// copiado en public/draco) y con meshopt, que son los formatos que usan muchas apps al exportar.

let loader;
function gltfLoader() {
  if (!loader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(new URL('draco/', document.baseURI).href);
    draco.setDecoderConfig({ type: 'wasm' });
    loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

// Un modelo se lee una vez; la estantería y el visor usan copias que comparten geometría y texturas.
// Por eso se marcan con userData.keep: quien las quite de la escena no debe liberarlas.
const cache = new Map();

export function loadModel(key) {
  if (!cache.has(key)) {
    const job = getModel(key)
      .then((buffer) => {
        if (!buffer) throw new Error('Modelo no encontrado');
        return new Promise((resolve, reject) => gltfLoader().parse(buffer, '', (gltf) => resolve(gltf.scene), reject));
      })
      .then((scene) => {
        scene.traverse((o) => { o.userData.keep = true; });
        return scene;
      });
    job.catch(() => cache.delete(key));
    cache.set(key, job);
  }
  return cache.get(key);
}

// Copia del modelo centrada, apoyada en y = 0 y escalada a la altura dada (sin pasar de maxWidth).
// userData.size guarda su tamaño final.
export function fitModel(source, height, maxWidth = Infinity) {
  const inner = source.clone(true);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  inner.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));

  const k = Math.min(height / (size.y || 1), maxWidth / (Math.max(size.x, size.z) || 1));
  const wrap = new THREE.Group();
  wrap.add(inner);
  wrap.scale.setScalar(k);
  wrap.userData.size = size.multiplyScalar(k);
  return wrap;
}
