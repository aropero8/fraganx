import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { analyzeComment } from '../lib/recommend.js';
import { CONDITIONS, CONDITION_EMOJI, OCCASIONS, STATUSES } from '../lib/constants.js';
import { Chips, Dots, Stars, Thumb } from './ui.jsx';

// three.js pesa: solo se descarga al abrir el visor
const Bottle3D = lazy(() => import('./Bottle3D.jsx'));

export default function PerfumeDetail({ id, focus, onBack, onEdit }) {
  const store = useStore();
  const p = store.perfumes.find((x) => x.id === id);
  const [text, setText] = useState('');
  const [sentiment, setSentiment] = useState(0);
  const [conditions, setConditions] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const commentRef = useRef(null);
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    if (focus === 'comment') commentRef.current?.focus();
  }, [focus]);

  if (!p) return null;

  const preview = text.trim() ? analyzeComment({ text, sentiment, conditions, occasions }) : null;

  const addComment = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    store.addComment(p.id, { text: text.trim(), sentiment, conditions, occasions });
    setText(''); setSentiment(0); setConditions([]); setOccasions([]);
  };

  const remove = () => {
    if (confirm(`¿Borrar ${p.name}? Se perderán sus comentarios y usos.`)) {
      store.deletePerfume(p.id);
      onBack();
    }
  };

  const wears = [...(p.wears || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link" onClick={onBack}>‹ Volver</button>
        <span />
        <button className="link link--strong" onClick={onEdit}>Editar</button>
      </header>

      <section className="hero">
        <Thumb perfume={p} size={96} />
        <div>
          <h1>{p.name}</h1>
          <p className="muted">{p.brand}</p>
          {p.rating > 0 && <Stars value={p.rating} size={16} />}
          {p.image && <button className="btn btn--ghost btn--small" onClick={() => setShow3d(true)}>🧊 Ver en 3D</button>}
        </div>
      </section>

      {show3d && (
        <Suspense fallback={<div className="viewer3d"><p className="viewer3d__msg muted">Cargando visor…</p></div>}>
          <Bottle3D perfume={p} onShapeChange={(shape) => store.savePerfume({ ...p, shape })} onClose={() => setShow3d(false)} />
        </Suspense>
      )}

      <div className="segmented segmented--small">
        {Object.entries(STATUSES).map(([k, label]) => (
          <button key={k} className={p.status === k ? 'on' : ''} onClick={() => store.setStatus(p.id, k)}>{label}</button>
        ))}
      </div>

      {p.status === 'tuve' && p.leftReason && <p className="muted small">Lo dejaste porque: {p.leftReason}</p>}

      <section className="card">
        {p.accords.length > 0 && (
          <div className="tags">{p.accords.map((a) => <span key={a} className="tag">{a}</span>)}</div>
        )}
        <dl className="specs">
          <dt>Proyección</dt><dd><Dots value={p.intensity} /></dd>
          <dt>Duración</dt><dd><Dots value={p.longevity} /></dd>
          {p.seasons.length > 0 && (<><dt>Estaciones</dt><dd>{p.seasons.join(', ')}</dd></>)}
          {p.occasions.length > 0 && (<><dt>Ocasiones</dt><dd>{p.occasions.join(', ')}</dd></>)}
          {p.sizeMl && (<><dt>Tamaño</dt><dd>{p.sizeMl} ml{p.price ? ` · ${p.price} €` : ''}</dd></>)}
        </dl>
        {(p.notes.top || p.notes.heart || p.notes.base) && (
          <div className="pyramid">
            {p.notes.top && <p><b>Salida</b> {p.notes.top}</p>}
            {p.notes.heart && <p><b>Corazón</b> {p.notes.heart}</p>}
            {p.notes.base && <p><b>Fondo</b> {p.notes.base}</p>}
          </div>
        )}
        {p.fragranticaUrl && (
          <a className="link" href={p.fragranticaUrl} target="_blank" rel="noreferrer">Ver en Fragrantica ↗</a>
        )}
      </section>

      <section>
        <h2>Mis comentarios</h2>
        <p className="muted small">Las recomendaciones los tienen en cuenta: escribe cuándo te funciona y cuándo no.</p>
        <form className="card comment-form" onSubmit={addComment}>
          <textarea
            ref={commentRef}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej. Con calor me empalaga / Perfecto para la oficina"
          />
          <div className="row">
            <button type="button" className={`chip ${sentiment === 1 ? 'chip--on' : ''}`} onClick={() => setSentiment(sentiment === 1 ? 0 : 1)}>👍 Me funciona</button>
            <button type="button" className={`chip ${sentiment === -1 ? 'chip--on' : ''}`} onClick={() => setSentiment(sentiment === -1 ? 0 : -1)}>👎 No me funciona</button>
          </div>
          <Chips small options={CONDITIONS.map((c) => ({ value: c, label: `${CONDITION_EMOJI[c]} ${c}` }))} value={conditions} onChange={setConditions} />
          <Chips small options={OCCASIONS} value={occasions} onChange={setOccasions} />
          {preview && (preview.conditions.size > 0 || preview.occasions.size > 0 || preview.sentiment !== 0) && (
            <p className="small muted">
              Lo entenderé como {preview.sentiment > 0 ? 'positivo' : preview.sentiment < 0 ? 'negativo' : 'neutro'}
              {[...preview.conditions, ...preview.occasions].length > 0 && ` para: ${[...preview.conditions, ...preview.occasions].join(', ')}`}
            </p>
          )}
          <button className="btn btn--primary" disabled={!text.trim()}>Añadir comentario</button>
        </form>

        <ul className="comments">
          {p.comments.map((c) => {
            const a = analyzeComment(c);
            return (
              <li key={c.id}>
                <p>{a.sentiment > 0 ? '👍 ' : a.sentiment < 0 ? '👎 ' : ''}{c.text}</p>
                <div className="row row--between">
                  <span className="muted small">
                    {new Date(c.date).toLocaleDateString('es-ES')}
                    {[...a.conditions, ...a.occasions].length > 0 && ` · ${[...a.conditions, ...a.occasions].join(', ')}`}
                  </span>
                  <button className="link small" onClick={() => store.deleteComment(p.id, c.id)}>Borrar</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {wears.length > 0 && (
        <section>
          <h2>Historial de uso <span className="muted">({wears.length})</span></h2>
          <ul className="wears">
            {wears.slice(0, 20).map((w) => (
              <li key={w.id}>
                <span>{new Date(w.date + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                <span className="muted small">
                  {w.temp != null && `${w.temp}°C`} {w.conditions?.map((c) => CONDITION_EMOJI[c]).join('')} {w.occasion || ''}
                </span>
                <span className="wear-fb">
                  <button className={w.feedback === 1 ? 'on' : ''} onClick={() => store.rateWear(p.id, w.id, w.feedback === 1 ? 0 : 1)}>👍</button>
                  <button className={w.feedback === -1 ? 'on' : ''} onClick={() => store.rateWear(p.id, w.id, w.feedback === -1 ? 0 : -1)}>👎</button>
                  <button onClick={() => store.undoWear(p.id, w.id)} aria-label="Quitar">✕</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button className="btn btn--danger btn--block" onClick={remove}>Borrar perfume</button>
    </div>
  );
}
