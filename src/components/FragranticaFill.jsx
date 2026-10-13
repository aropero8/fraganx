import { useState } from 'react';
import { parseFragrantica } from '../lib/fragrantica.js';
import { useToast } from './ui.jsx';

const FIELD_LABELS = {
  name: 'nombre', brand: 'marca', accords: 'acordes', notes: 'notas', seasons: 'estaciones', occasions: 'ocasiones',
  daytime: 'día/noche', community: 'longevidad y estela', fragranticaUrl: 'enlace',
};

// Pegar el enlace o el texto copiado de la ficha de Fragrantica (seleccionar todo → copiar).
// "open" lo muestra ya desplegado; "url" añade el enlace para abrir la ficha.
export default function FragranticaFill({ onFill, url, open: startOpen = false, title = 'Rellenar desde Fragrantica', children }) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState('');
  const toast = useToast();

  const fill = () => {
    const data = parseFragrantica(text);
    const keys = Object.keys(data);
    if (!keys.length) return toast('No encuentro datos de Fragrantica en ese texto.');
    onFill(data);
    setText('');
    setOpen(startOpen);
    const labels = [...new Set(keys.map((k) => FIELD_LABELS[k]).filter(Boolean))];
    const missing = data.accords && !data.community ? ' Sin longevidad ni estela: baja hasta el final de la página antes de copiar.' : '';
    toast(`Rellenado: ${labels.join(', ')}.${missing}`);
  };

  if (!open) {
    return <button type="button" className="btn btn--block" onClick={() => setOpen(true)}>{title}</button>;
  }
  return (
    <section className="card">
      <h3>{title}</h3>
      {children}
      <ol className="steps muted small">
        <li>
          Abre la ficha del perfume en Fragrantica
          {url && <> · <a className="link" href={url} target="_blank" rel="noreferrer">abrir ↗</a></>}
        </li>
        <li>Baja hasta el final de la página, para que cargue la longevidad y la estela</li>
        <li>Selecciona todo, copia y pégalo aquí</li>
      </ol>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus={!startOpen}
        placeholder="Pega aquí el texto de la página (o solo el enlace, para nombre y marca)" />
      <div className="row">
        <button type="button" className="btn btn--primary" disabled={!text.trim()} onClick={fill}>Rellenar</button>
        {!startOpen && <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>}
      </div>
    </section>
  );
}
