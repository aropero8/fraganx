// Modelos 3D importados (.glb). Pesan demasiado para ir con el resto de datos (Preferences guarda
// todo en un único JSON), así que se guardan en IndexedDB, que también funciona dentro del WebView
// de Android. No entran en la copia de seguridad.

const DB_NAME = 'fraganx-models';
const STORE = 'models';

let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Los .glb empiezan por los bytes "glTF"
export const isGlb = (buffer) =>
  buffer.byteLength > 12 && new TextDecoder().decode(new Uint8Array(buffer, 0, 4)) === 'glTF';

export const getModel = (key) => run('readonly', (s) => s.get(key));

export async function saveModel(buffer) {
  const key = uid();
  await run('readwrite', (s) => s.put(buffer, key));
  return key;
}

// Borra los modelos que ya no usa ningún perfume (borrados, cambiados o importados sin guardar)
export async function pruneModels(keep) {
  const used = new Set(keep);
  const keys = await run('readonly', (s) => s.getAllKeys());
  const unused = keys.filter((k) => !used.has(k));
  if (unused.length) await run('readwrite', (s) => { unused.forEach((k) => s.delete(k)); return s.count(); });
}
