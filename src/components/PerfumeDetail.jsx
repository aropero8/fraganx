import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { analyzeComment, daysSince } from '../lib/recommend.js';
import { accordColor, cap, CONDITIONS, CONDITION_EMOJI, daytimeLabel, OCCASION_EMOJI, OCCASIONS, STATUSES } from '../lib/constants.js';
import { accordGradient, Chips, Dots, Icon, Stars, useToast } from './ui.jsx';
import { AccordBars, LONGEVITY_VOTES, NotePyramid, SILLAGE_VOTES, VoteBars } from './FragranceProfile.jsx';
import FragranticaFill from './FragranticaFill.jsx';
import { mergeFragrantica } from '../lib/fragrantica.js';
import { hasNotes as notesOf, loadFromFragrantica, needsFragrantica } from '../lib/fragranticaPage.js';

// three.js pesa: se descarga aparte y mientras tanto se ve la foto
const Bottle3D = lazy(() => import('./Bottle3D.jsx'));

function Showcase({ perfume: p }) {
  if (!p.image) {
    const g = accordGradient(p.accords);
    return (
      <div className="showcase showcase--empty" style={{ '--g': g.background }}>
        <span className="showcase__initial" style={{ color: g.color }}>{(p.name.trim()[0] || '?').toUpperCase()}</span>
      </div>
    );
  }
  return (
    <div className="showcase">
      <img className="showcase__bg" src={p.image} alt="" aria-hidden="true" />
      <img className="showcase__img" src={p.image} alt={p.name} />
    </div>
  );
}

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
  const [sync, setSync] = useState({ state: 'idle' }); // descarga de Fragrantica: idle | loading | error

  useEffect(() => {
    if (focus === 'comment') commentRef.current?.focus();
  }, [focus]);

  // Descarga su ficha de Fragrantica con el enlace que ya tiene
  const download = async (manual = false) => {
    const url = store.perfumes.find((x) => x.id === id)?.fragranticaUrl;
    if (!url) return;
    setSync({ state: 'loading' });
    try {
      const data = await loadFromFragrantica(url);
      store.updatePerfume(id, (cur) => mergeFragrantica(cur, { ...data, fragranticaFetchedAt: Date.now() }));
      setSync({ state: 'idle' });
      if (manual) toast('Ficha actualizada desde Fragrantica');
    } catch (e) {
      setSync({ state: 'error', message: e.message });
    }
  };

  // Al abrir uno sin acordes o notas, se completa solo (una vez: si la página no los trae, no insiste)
  useEffect(() => {
    if (p && needsFragrantica(p) && !p.fragranticaFetchedAt) download();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Lo que aún no tiene de Fragrantica: se ofrece completarlo arriba, antes de la ficha
  const hasNotes = notesOf(p);
  const community = p.community?.longevity || p.community?.sillage ? p.community : null;
  const missing = [!p.accords.length && 'acordes', !hasNotes && 'notas'].filter(Boolean);
  // Sin enlace, o si la descarga no ha bastado, queda pegar el texto de la página
  const askPaste = missing.length > 0 && sync.state !== 'loading'
    && (!p.fragranticaUrl || sync.state === 'error' || Boolean(p.fragranticaFetchedAt));
  const fillFromFragrantica = (data) => store.savePerfume(mergeFragrantica(p, data));

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link link--icon" onClick={onBack}><Icon name="back" size={20} /> Volver</button>
        <span />
        <button className="link link--strong" onClick={onEdit}>Editar</button>
      </header>

      {/* El frasco en 3D arriba y la ficha debajo; a pantalla completa se puede acercar y cambiar la forma */}
      <section className="hero3d" style={{ '--c': accordColor(p.accords[0]) }}>
        {show3d ? <div className="hero3d__stage" /> : (
          <Suspense fallback={<Showcase perfume={p} />}>
            <Bottle3D inline perfume={p} />
          </Suspense>
        )}
        <button className="showcase__3d" onClick={() => setShow3d(true)}>
          <Icon name="cube" size={18} /> Ampliar
        </button>
      </section>

      <section className="title-block">
        <p className="eyebrow">{p.brand || 'Sin marca'}</p>
        <h1>{p.name}</h1>
        {p.rating > 0 && <Stars value={p.rating} size={18} />}
      </section>

      {show3d && (
        <Suspense fallback={<div className="viewer3d"><p className="viewer3d__msg muted">Cargando visor…</p></div>}>
          <Bottle3D perfume={p} onBottleChange={(bottle) => store.savePerfume({ ...p, bottle })} onClose={() => setShow3d(false)} />
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

      {sync.state === 'loading' && (
        <section className="card card--sync">
          <p className="muted small">Descargando la ficha de Fragrantica…</p>
        </section>
      )}

      {sync.state === 'error' && (
        <section className="card">
          <h3>No pude descargar la ficha</h3>
          <p className="muted small">{sync.message}. Comprueba la conexión y vuelve a intentarlo, o pega abajo el texto de la página.</p>
          <button className="btn" onClick={() => download(true)}>Reintentar</button>
        </section>
      )}

      {askPaste && (
        <FragranticaFill open url={p.fragranticaUrl} onFill={fillFromFragrantica} title="Completa la ficha con Fragrantica">
          <p className="muted small">Falta{missing.length > 1 ? 'n' : ''}: {missing.join(', ')}.</p>
        </FragranticaFill>
      )}

      {p.accords.length > 0 && (
        <section className="card">
          <h3>Acordes principales</h3>
          <AccordBars perfume={p} />
        </section>
      )}

      {hasNotes && (
        <section className="card">
          <h3>Pirámide olfativa</h3>
          <NotePyramid notes={p.notes} />
        </section>
      )}

      <section className="card">
        <h3>Cuándo y cómo</h3>
        {community && (
          <>
            <VoteBars title="Longevidad" options={LONGEVITY_VOTES} votes={community.longevity} />
            <VoteBars title="Estela (proyección)" options={SILLAGE_VOTES} votes={community.sillage} />
            <p className="muted tiny">Votos de la comunidad de Fragrantica</p>
          </>
        )}
        <dl className="specs">
          {!community?.sillage && (<><dt>Proyección</dt><dd><Dots value={p.intensity} /></dd></>)}
          {!community?.longevity && (<><dt>Duración</dt><dd><Dots value={p.longevity} /></dd></>)}
          {p.seasons.length > 0 && (<><dt>Estaciones</dt><dd>{p.seasons.map(cap).join(', ')}</dd></>)}
          {p.daytime > 0 && (<><dt>Cuándo</dt><dd>{daytimeLabel(p.daytime)}</dd></>)}
          {p.occasions.length > 0 && (<><dt>Ocasiones</dt><dd>{p.occasions.map((o) => `${OCCASION_EMOJI[o] || ''} ${cap(o)}`).join(', ')}</dd></>)}
          {p.sizeMl && (<><dt>Tamaño</dt><dd>{p.sizeMl} ml{p.price ? ` · ${p.price} €` : ''}</dd></>)}
        </dl>
        {!community && (
          <p className="muted tiny">
            La longevidad y la estela no vienen en la ficha descargada: puedes añadirlas abajo pegando el texto de su página.
          </p>
        )}
        {p.fragranticaUrl && (
          <a className="link" href={p.fragranticaUrl} target="_blank" rel="noreferrer">Ver en Fragrantica ↗</a>
        )}
      </section>

      {p.fragranticaUrl && missing.length === 0 && (
        <button className="btn btn--block" disabled={sync.state === 'loading'} onClick={() => download(true)}>
          {sync.state === 'loading' ? 'Descargando…' : 'Actualizar desde Fragrantica'}
        </button>
      )}
      {!askPaste && (
        <FragranticaFill url={p.fragranticaUrl} onFill={fillFromFragrantica}
          title={community ? 'Pegar texto de Fragrantica' : 'Añadir longevidad y estela'} />
      )}

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
