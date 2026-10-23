import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { SAMPLES } from '../lib/samples.js';
import { mergeFragrantica, parseFragranticaUrlList } from '../lib/fragrantica.js';
import { canDownloadFragrantica, completeFromFragrantica, needsFragrantica, subscribeBatch } from '../lib/fragranticaPage.js';
import { WARDROBE_BOOKMARKLET, canReadWardrobe, profileUrl, readWardrobe } from '../lib/fragranticaWardrobe.js';
import { useToast } from './ui.jsx';

// CSV mínimo: nombre;marca;estado;acordes(separados por coma);valoración
function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = lines[0]?.includes(';') ? ';' : ',';
  const rows = lines.map((l) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, '')));
  const header = rows[0].map((h) => h.toLowerCase());
  const hasHeader = header.includes('nombre') || header.includes('name');
  const body = hasHeader ? rows.slice(1) : rows;
  const statusMap = { tengo: 'tengo', have: 'tengo', quiero: 'quiero', want: 'quiero', tuve: 'tuve', had: 'tuve' };
  return body
    .filter((r) => r[0])
    .map(([name, brand = '', status = 'tengo', accords = '', rating = '']) => ({
      name,
      brand,
      status: statusMap[status.toLowerCase()] || 'tengo',
      accords: accords ? accords.split(/[,|]/).map((a) => a.trim().toLowerCase()).filter(Boolean) : [],
      rating: parseFloat(rating) || 0,
    }));
}

// Para no importar dos veces el mismo perfume: el número del enlace de Fragrantica, o nombre y marca
const fragranticaId = (url) => /-(\d+)\.html/.exec(url || '')?.[1];
const sameKey = (p) => p.name && `${p.name}|${p.brand || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9|]/gi, '').toLowerCase();

export default function Settings() {
  const store = useStore();
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [progress, setProgress] = useState(null); // { done, total, name } mientras se completan
  const [autoComplete, setAutoComplete] = useState(false);
  const [profile, setProfile] = useState(() => { try { return localStorage.getItem('fragranticaProfile') || ''; } catch { return ''; } });
  const [readingWardrobe, setReadingWardrobe] = useState(false);

  const pending = store.perfumes.filter(needsFragrantica);
  useEffect(() => subscribeBatch(setProgress), []);

  // Descarga de Fragrantica los que tienen enlace pero les faltan acordes o notas, de uno en uno
  const completeAll = async () => {
    if (progress || !pending.length) return;
    const result = await completeFromFragrantica(
      pending,
      (id, data) => store.updatePerfume(id, (cur) => mergeFragrantica(cur, { ...data, fragranticaFetchedAt: Date.now() })),
    );
    if (!result) return;
    const { ok, failed } = result;
    toast(failed ? `Completados ${ok}; ${failed} no se pudieron descargar (reinténtalo desde su ficha).` : `Completados ${ok} perfumes desde Fragrantica.`);
  };

  // Tras importar enlaces, se completan solos (cuando ya están guardados)
  useEffect(() => {
    if (!autoComplete) return;
    setAutoComplete(false);
    completeAll();
  }, [autoComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const backup = JSON.stringify({ version: 1, perfumes: store.perfumes, location: store.location, shelves: store.shelves });

  const exportJson = async () => {
    try {
      await navigator.clipboard.writeText(backup);
      toast('Copia de seguridad copiada al portapapeles. Pégala en una nota o en un email.');
    } catch {
      toast('No pude copiar al portapapeles.');
    }
    // En navegador además descargamos el archivo
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
    a.download = `fraganx-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  // Perfumes con enlace de Fragrantica: los que ya tienes (mismo enlace, o mismo nombre y marca) no se repiten
  const importLinks = (all) => {
    const known = new Set(store.perfumes.flatMap((p) => [fragranticaId(p.fragranticaUrl), sameKey(p)]).filter(Boolean));
    const links = all.filter((p) => !known.has(fragranticaId(p.fragranticaUrl)) && !known.has(sameKey(p)));
    const skipped = all.length - links.length;
    const already = skipped ? ` (${skipped} ya estaban)` : '';
    if (!links.length) return toast(`Ya tenías los ${all.length} perfumes.`);
    store.mergePerfumes(links);
    if (canDownloadFragrantica) {
      toast(`Añadidos ${links.length} perfumes${already}. Descargo sus fichas de Fragrantica…`);
      setAutoComplete(true);
    } else toast(`Añadidos ${links.length} perfumes${already}. Completa cada uno pegando el texto de su página en su ficha.`);
  };

  const importWardrobe = async () => {
    const url = profileUrl(profile);
    if (!url) return toast('Escribe tu usuario de Fragrantica o el enlace de tu perfil.');
    try { localStorage.setItem('fragranticaProfile', profile.trim()); } catch { /* no pasa nada */ }
    setReadingWardrobe(true);
    try {
      importLinks(await readWardrobe(url));
    } catch (e) {
      if (e.message !== 'Cancelado') toast(e.message || 'No he podido leer tu armario.');
    } finally {
      setReadingWardrobe(false);
    }
  };

  const importText = (text) => {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data.perfumes)) throw new Error();
      if (confirm(`Esto reemplaza tu colección por ${data.perfumes.length} perfumes. ¿Seguir?`)) {
        store.replaceAll(data);
        toast('Copia restaurada.');
      }
    } catch {
      const links = parseFragranticaUrlList(text);
      if (links.length) {
        setCsv('');
        importLinks(links);
        return;
      }
      const rows = parseCsv(text);
      if (rows.length) {
        store.mergePerfumes(rows);
        toast(`Añadidos ${rows.length} perfumes desde CSV.`);
        setCsv('');
      } else toast('No reconozco ese formato.');
    }
  };

  return (
    <div className="screen">
      <header className="screen__head">
        <h1>Ajustes</h1>
      </header>

      <section className="card">
        <h3>Importar tu colección</h3>
        <p className="muted small">
          Pega una lista (una línea por perfume): <code>nombre;marca;estado;acordes;valoración</code>.
          El estado puede ser tengo, quiero o tuve. También puedes pegar enlaces de Fragrantica
          (uno por línea, con <code>;quiero</code> o <code>;tuve</code> detrás si no lo tienes) o una copia de seguridad.
        </p>
        <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)}
          placeholder={"Sauvage;Dior;tengo;especiado,aromático;4\nAventus;Creed;quiero;afrutado,amaderado;"} />
        <div className="row">
          <button className="btn btn--primary" disabled={!csv.trim()} onClick={() => importText(csv)}>Importar</button>
          <label className="btn">
            Desde archivo
            <input type="file" accept=".json,.csv,.txt" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) importText(await f.text());
            }} />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Traer tu armario de Fragrantica</h3>
        {canReadWardrobe ? (
          <>
            <p className="muted small">
              Abro tu perfil y añado lo que tengas en Tengo, Quiero, Tuve y Para probar (este entra como quiero).
              Los que ya tengas no se repiten.
            </p>
            <input value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="Tu usuario (erizopanzon) o el enlace de tu perfil"
              autoCapitalize="off" autoCorrect="off" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && importWardrobe()} />
            <button className="btn btn--primary btn--block" disabled={readingWardrobe || !profile.trim()} onClick={importWardrobe}>
              {readingWardrobe ? 'Leyendo tu armario…' : 'Traer mi armario'}
            </button>
          </>
        ) : (<>
        <p className="muted small">
          Fragrantica no deja exportarlo, pero un marcador lo copia desde tu perfil (Tengo, Quiero, Tuve y Para probar,
          que entra como quiero):
        </p>
        <ol className="muted small">
          <li>Pulsa <b>Copiar marcador</b>.</li>
          <li>En Safari guarda cualquier página en Marcadores. Luego edita ese marcador y cambia su dirección por lo copiado.</li>
          <li>Abre tu perfil de Fragrantica (<code>fragrantica.es/@tu-usuario</code>) y abre el marcador.</li>
          <li>Pulsa <b>Copiar</b> y pégalo arriba, en <b>Importar</b>. Los que ya tengas no se repiten.</li>
        </ol>
        <button className="btn btn--block" onClick={async () => {
          try { await navigator.clipboard.writeText(WARDROBE_BOOKMARKLET); toast('Marcador copiado.'); }
          catch { toast('No he podido copiarlo.'); }
        }}>Copiar marcador</button>
        </>)}
      </section>

      {(pending.length > 0 || progress) && (
        <section className="card">
          <h3>Completar desde Fragrantica</h3>
          {progress ? (
            <>
              <p className="muted small">Descargando {progress.done + 1} de {progress.total}: <b>{progress.name}</b></p>
              <progress className="progress" value={progress.done} max={progress.total} />
            </>
          ) : (
            <>
              <p className="muted small">
                {pending.length} perfume{pending.length > 1 ? 's tienen' : ' tiene'} enlace pero sin acordes o notas.
                Descargo sus fichas de una en una (unos segundos cada una).
              </p>
              <button className="btn btn--primary btn--block" onClick={completeAll}>Completar {pending.length}</button>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h3>Copia de seguridad</h3>
        <p className="muted small">{store.perfumes.length} perfumes guardados en este dispositivo. Exporta de vez en cuando para no perderlos si cambias de móvil.</p>
        <button className="btn btn--block" onClick={exportJson}>Exportar copia</button>
      </section>

      <section className="card">
        <h3>Datos de prueba</h3>
        <p className="muted small">Seis perfumes de ejemplo para ver cómo funcionan las recomendaciones.</p>
        <div className="row">
          <button className="btn" onClick={() => { store.mergePerfumes(SAMPLES); toast('Ejemplos añadidos.'); }}>Cargar ejemplos</button>
          <button className="btn btn--danger" onClick={() => {
            if (confirm('¿Borrar TODOS los perfumes?')) { store.replaceAll({ perfumes: [], location: store.location }); toast('Colección vaciada.'); }
          }}>Borrar todo</button>
        </div>
      </section>

      <p className="muted small center">Tiempo: Open-Meteo · FraganX v0.1</p>
    </div>
  );
}
