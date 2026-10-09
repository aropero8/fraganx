import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { analyzeComment, daysSince } from '../lib/recommend.js';
import { cap, CONDITIONS, CONDITION_EMOJI, OCCASION_EMOJI, OCCASIONS, STATUSES } from '../lib/constants.js';
import { AccordBar, AccordTags, accordGradient, Chips, Dots, Icon, Stars, useToast } from './ui.jsx';

// three.js pesa: solo se descarga al abrir el visor
const Bottle3D = lazy(() => import('./Bottle3D.jsx'));

const CONDITION_OPTIONS = CONDITIONS.map((c) => ({ value: c, label: `${CONDITION_EMOJI[c]} ${cap(c)}` }));
const OCCASION_OPTIONS = OCCASIONS.map((o) => ({ value: o, label: `${OCCASION_EMOJI[o]} ${cap(o)}` }));

function ago(date) {
  const d = daysSince(date);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 30) return `Hace ${d} días`;
  return new Date(date + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function PerfumeDetail({ id, focus, onBack, onEdit }) {
  const store = useStore();
  const toast = useToast();
  const p = store.perfumes.find((x) => x.id === id);
  const [text, setText] = useState('');
  const [sentiment, setSentiment] = useState(0);
  const [conditions, setConditions] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [composing, setComposing] = useState(false);
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
    setText(''); setSentiment(0); setConditions([]); setOccasions([]); setComposing(false);
    commentRef.current?.blur();
    toast('Comentario guardado');
  };

  const removeComment = (c) => {
    store.deleteComment(p.id, c.id);
    toast('Comentario borrado', { label: 'Deshacer', onClick: () => store.restoreComment(p.id, c) });
  };

  const remove = () => {
    store.deletePerfume(p.id);
    onBack();
    toast(`${p.name} borrado`, { label: 'Deshacer', onClick: () => store.savePerfume(p) });
  };

  const wears = [...(p.wears || [])].sort((a, b) => b.date.localeCompare(a.date));
  const rated = wears.filter((w) => w.feedback);
  const hitRate = rated.length ? Math.round((rated.filter((w) => w.feedback > 0).length / rated.length) * 100) : null;

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link link--icon" onClick={onBack}><Icon name="back" size={20} /> Volver</button>
        <span />
        <button className="link link--strong" onClick={onEdit}>Editar</button>
      </header>

      <section className={`showcase ${p.image ? '' : 'showcase--empty'}`} style={{ '--g': accordGradient(p.accords).background }}>
        {p.image ? (
          <>
            <img className="showcase__bg" src={p.image} alt="" aria-hidden="true" />
            <img className="showcase__img" src={p.image} alt={p.name} />
          </>
        ) : (
          <span className="showcase__initial" style={{ color: accordGradient(p.accords).color }}>{(p.name.trim()[0] || '?').toUpperCase()}</span>
        )}
        <button className="showcase__3d" onClick={() => setShow3d(true)}>
          <Icon name="cube" size={18} /> Ver en 3D
        </button>
      </section>

      <section className="title-block">
        <p className="eyebrow">{p.brand || 'Sin marca'}</p>
        <h1>{p.name}</h1>
        {p.rating > 0 && <Stars value={p.rating} size={18} />}
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

      {p.status === 'tengo' && (
        <div className="stats">
          <div><b>{wears.length}</b><span>usos</span></div>
          <div><b>{wears[0] ? ago(wears[0].date) : '—'}</b><span>última vez</span></div>
          <div><b>{hitRate != null ? `${hitRate}%` : '—'}</b><span>acierto</span></div>
        </div>
      )}

      <section className="card">
        {p.accords.length > 0 && (
          <>
            <AccordBar accords={p.accords} />
            <AccordTags accords={p.accords} />
          </>
        )}
        <dl className="specs">
          <dt>Proyección</dt><dd><Dots value={p.intensity} /></dd>
          <dt>Duración</dt><dd><Dots value={p.longevity} /></dd>
          {p.seasons.length > 0 && (<><dt>Estaciones</dt><dd>{p.seasons.map(cap).join(', ')}</dd></>)}
          {p.occasions.length > 0 && (<><dt>Ocasiones</dt><dd>{p.occasions.map((o) => `${OCCASION_EMOJI[o] || ''} ${cap(o)}`).join(', ')}</dd></>)}
          {p.sizeMl && (<><dt>Tamaño</dt><dd>{p.sizeMl} ml{p.price ? ` · ${p.price} €` : ''}</dd></>)}
        </dl>
        {(p.notes.top || p.notes.heart || p.notes.base) && (
          <div className="pyramid">
            {p.notes.top && <p><b>Salida</b> <span>{p.notes.top}</span></p>}
            {p.notes.heart && <p><b>Corazón</b> <span>{p.notes.heart}</span></p>}
            {p.notes.base && <p><b>Fondo</b> <span>{p.notes.base}</span></p>}
          </div>
        )}
        {p.fragranticaUrl && (
          <a className="link" href={p.fragranticaUrl} target="_blank" rel="noreferrer">Ver en Fragrantica ↗</a>
        )}
      </section>

      <section className="stack">
        <h2>Mis comentarios</h2>
        <p className="muted small">Las recomendaciones los tienen en cuenta: escribe cuándo te funciona y cuándo no.</p>
        <form className="card comment-form" onSubmit={addComment}>
          <textarea
            ref={commentRef}
            rows={composing || text ? 3 : 1}
            value={text}
            onFocus={() => setComposing(true)}
            onChange={(e) => setText(e.target.value)}
            placeholder={composing ? 'Ej. Con calor me empalaga / Perfecto para la oficina' : 'Añade un comentario…'}
          />
          {(composing || text) && (
            <>
              <div className="row">
                <button type="button" className={`chip chip--pro ${sentiment === 1 ? 'chip--on' : ''}`} aria-pressed={sentiment === 1} onClick={() => setSentiment(sentiment === 1 ? 0 : 1)}>👍 Me funciona</button>
                <button type="button" className={`chip chip--con ${sentiment === -1 ? 'chip--on' : ''}`} aria-pressed={sentiment === -1} onClick={() => setSentiment(sentiment === -1 ? 0 : -1)}>👎 No me funciona</button>
              </div>
              <p className="label">¿Cuándo? <span className="muted">(opcional, si no lo deduzco del texto)</span></p>
              <Chips small options={CONDITION_OPTIONS} value={conditions} onChange={setConditions} />
              <Chips small options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} />
              {preview && (preview.conditions.size > 0 || preview.occasions.size > 0 || preview.sentiment !== 0) && (
                <p className="hint">
                  Lo entenderé como <b className={preview.sentiment > 0 ? 'pro' : preview.sentiment < 0 ? 'con' : ''}>{preview.sentiment > 0 ? 'positivo' : preview.sentiment < 0 ? 'negativo' : 'neutro'}</b>
                  {[...preview.conditions, ...preview.occasions].length > 0 && ` para: ${[...preview.conditions, ...preview.occasions].join(', ')}`}
                </p>
              )}
              <div className="row">
                <button className="btn btn--primary grow" disabled={!text.trim()}>Añadir comentario</button>
                {!text && <button type="button" className="btn btn--ghost" onClick={() => setComposing(false)}>Cancelar</button>}
              </div>
            </>
          )}
        </form>

        <ul className="comments">
          {p.comments.map((c) => {
            const a = analyzeComment(c);
            return (
              <li key={c.id} className={a.sentiment > 0 ? 'is-pro' : a.sentiment < 0 ? 'is-con' : ''}>
                <p>{a.sentiment > 0 ? '👍 ' : a.sentiment < 0 ? '👎 ' : ''}{c.text}</p>
                <div className="row row--between">
                  <span className="muted small">
                    {new Date(c.date).toLocaleDateString('es-ES')}
                    {[...a.conditions, ...a.occasions].length > 0 && ` · ${[...a.conditions, ...a.occasions].join(', ')}`}
                  </span>
                  <button className="link link--muted small" onClick={() => removeComment(c)}>Borrar</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {wears.length > 0 && (
        <section className="stack">
          <h2>Historial de uso <span className="muted">({wears.length})</span></h2>
          <ul className="wears">
            {wears.slice(0, 20).map((w) => (
              <li key={w.id}>
                <span className="wears__date">{new Date(w.date + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                <span className="muted small">
                  {w.temp != null && `${w.temp}°C`} {w.conditions?.map((c) => CONDITION_EMOJI[c]).join('')} {w.occasion ? `${OCCASION_EMOJI[w.occasion] || ''} ${w.occasion}` : ''}
                </span>
                <span className="wear-fb">
                  <button className={w.feedback === 1 ? 'on' : ''} aria-pressed={w.feedback === 1} aria-label="Me fue bien" onClick={() => store.rateWear(p.id, w.id, w.feedback === 1 ? 0 : 1)}>👍</button>
                  <button className={w.feedback === -1 ? 'on' : ''} aria-pressed={w.feedback === -1} aria-label="No acertó" onClick={() => store.rateWear(p.id, w.id, w.feedback === -1 ? 0 : -1)}>👎</button>
                  <button onClick={() => store.undoWear(p.id, w.id)} aria-label="Quitar uso">✕</button>
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
