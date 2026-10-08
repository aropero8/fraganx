import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { SAMPLES } from '../lib/samples.js';

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

export default function Settings() {
  const store = useStore();
  const [msg, setMsg] = useState('');
  const [csv, setCsv] = useState('');

  const backup = JSON.stringify({ version: 1, perfumes: store.perfumes, location: store.location });

  const exportJson = async () => {
    try {
      await navigator.clipboard.writeText(backup);
      setMsg('Copia de seguridad copiada al portapapeles. Pégala en una nota o en un email.');
    } catch {
      setMsg('No pude copiar al portapapeles.');
    }
    // En navegador además descargamos el archivo
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
    a.download = `perfumario-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importText = (text) => {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data.perfumes)) throw new Error();
      if (confirm(`Esto reemplaza tu colección por ${data.perfumes.length} perfumes. ¿Seguir?`)) {
        store.replaceAll(data);
        setMsg('Copia restaurada.');
      }
    } catch {
      const rows = parseCsv(text);
      if (rows.length) {
        store.mergePerfumes(rows);
        setMsg(`Añadidos ${rows.length} perfumes desde CSV.`);
        setCsv('');
      } else setMsg('No reconozco ese formato.');
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
          El estado puede ser tengo, quiero o tuve. También puedes pegar aquí una copia de seguridad.
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
        <h3>Copia de seguridad</h3>
        <p className="muted small">{store.perfumes.length} perfumes guardados en este dispositivo.</p>
        <button className="btn btn--block" onClick={exportJson}>Exportar copia</button>
      </section>

      <section className="card">
        <h3>Datos de prueba</h3>
        <div className="row">
          <button className="btn" onClick={() => { store.mergePerfumes(SAMPLES); setMsg('Ejemplos añadidos.'); }}>Cargar ejemplos</button>
          <button className="btn btn--danger" onClick={() => {
            if (confirm('¿Borrar TODOS los perfumes?')) { store.replaceAll({ perfumes: [], location: store.location }); setMsg('Colección vaciada.'); }
          }}>Borrar todo</button>
        </div>
      </section>

      {msg && <p className="toast">{msg}</p>}

      <p className="muted small center">Tiempo: Open-Meteo · Perfumario v0.1</p>
    </div>
  );
}
