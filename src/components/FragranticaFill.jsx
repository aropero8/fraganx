import { useState } from 'react';
import { parseFragrantica, parseFragranticaUrl } from '../lib/fragrantica.js';
import { loadFromFragrantica } from '../lib/fragranticaPage.js';
import { useToast } from './ui.jsx';

const FIELD_LABELS = {
  name: 'nombre', brand: 'marca', accords: 'acordes', notes: 'notas', seasons: 'estaciones', occasions: 'ocasiones',
  daytime: 'día/noche', community: 'longevidad y estela', fragranticaUrl: 'enlace',
};

// Pegar el enlace (y la app descarga la página) o el texto copiado de la ficha de Fragrantica,
// que además trae las votaciones. "open" lo muestra ya desplegado; "url" añade el enlace a la ficha.
export default function FragranticaFill({ onFill, url, open: startOpen = false, title = 'Rellenar desde Fragrantica', children }) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const fill = async () => {
    const link = parseFragranticaUrl(text);
    const onlyLink = link && text.trim().length <= link.url.length + 12;
    let data;
    if (onlyLink) {
      setLoading(true);
      try {
        data = { fragranticaUrl: link.url, name: link.name, brand: link.brand, ...(await loadFromFragrantica(link.url)) };
      } catch (e) {
        data = { fragranticaUrl: link.url, name: link.name, brand: link.brand };
        toast(`No pude descargar la página (${e.message}). Relleno nombre y marca.`);
      } finally {
        setLoading(false);
      }
    } else {
      data = parseFragrantica(text);
    }
    const keys = Object.keys(data);
    if (!keys.length) return toast('No encuentro datos de Fragrantica en ese texto.');
    onFill(data);
    setText('');
    setOpen(startOpen);
    const labels = [...new Set(keys.map((k) => FIELD_LABELS[k]).filter(Boolean))];
    const missing = !onlyLink && data.accords && !data.community ? ' Sin longevidad ni estela: baja hasta el final de la página antes de copiar.' : '';
    if (!onlyLink || data.accords) toast(`Rellenado: ${labels.join(', ')}.${missing}`);
  };

  if (!open) {
    return <button type="button" className="btn btn--block" onClick={() => setOpen(true)}>{title}</button>;
  }
  return (
    <section className="card">
      <h3>{title}</h3>
      {children}
      <p className="muted small">
        Pega el enlace del perfume y descargo su ficha. Para tener también las votaciones (estaciones,
        longevidad y estela), abre la página{url && <> (<a className="link" href={url} target="_blank" rel="noreferrer">abrir ↗</a>)</>},
        baja hasta el final, selecciona todo, copia y pégalo aquí.
      </p>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus={!startOpen}
        placeholder="https://www.fragrantica.es/perfume/… o el texto de la página" />
      <div className="row">
        <button type="button" className="btn btn--primary" disabled={!text.trim() || loading} onClick={fill}>
          {loading ? 'Descargando…' : 'Rellenar'}
        </button>
        {!startOpen && <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>}
      </div>
    </section>
  );
}
