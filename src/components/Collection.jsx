import { lazy, Suspense, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { accordColor, cap, STATUSES } from '../lib/constants.js';
import { SAMPLES } from '../lib/samples.js';
import { AccordBar, Icon, Stars, Thumb } from './ui.jsx';

// three.js pesa: solo se descarga al ver la estantería o abrir un frasco
const Shelf3D = lazy(() => import('./Shelf3D.jsx'));
const Bottle3D = lazy(() => import('./Bottle3D.jsx'));

const LAYOUTS = [
  { id: 'shelf', icon: 'shelf', label: 'Estantería' },
  { id: 'grid', icon: 'grid', label: 'Cuadrícula' },
  { id: 'list', icon: 'list', label: 'Lista' },
];

const SORTS = {
  recent: { label: 'Recientes', fn: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  rating: { label: 'Valoración', fn: (a, b) => (b.rating || 0) - (a.rating || 0) },
  name: { label: 'Nombre', fn: (a, b) => a.name.localeCompare(b.name) },
  worn: { label: 'Más usados', fn: (a, b) => (b.wears?.length || 0) - (a.wears?.length || 0) },
};

const EMPTY = {
  tengo: 'Aún no has añadido ningún perfume que tengas.',
  quiero: 'Apunta aquí los perfumes que te gustaría probar o comprar.',
  tuve: 'Los que ya no tienes, para recordar qué te gustó y qué no.',
};

// Preferencia de vista: solo comodidad, si falla el almacenamiento usamos la estantería.
// (La clave mantiene el nombre antiguo del proyecto, como la de store.jsx.)
const readLayout = () => {
  try {
    const v = localStorage.getItem('perfumario:layout');
    return LAYOUTS.some((l) => l.id === v) ? v : 'shelf';
  } catch { return 'shelf'; }
};
const saveLayout = (v) => { try { localStorage.setItem('perfumario:layout', v); } catch { /* sin almacenamiento */ } };

export default function Collection({ openPerfume, newPerfume }) {
  const store = useStore();
  const { perfumes } = store;
  const [tab, setTab] = useState('tengo');
  const [q, setQ] = useState('');
  const [accord, setAccord] = useState(null);
  const [sort, setSort] = useState('recent');
  const [layout, setLayout] = useState(readLayout);
  const [viewing, setViewing] = useState(null); // id del frasco abierto en 3D

  const counts = useMemo(
    () => Object.fromEntries(Object.keys(STATUSES).map((s) => [s, perfumes.filter((p) => p.status === s).length])),
    [perfumes],
  );

  const inTab = useMemo(() => perfumes.filter((p) => p.status === tab), [perfumes, tab]);

  // Acordes presentes en esta pestaña, de más a menos frecuentes
  const accords = useMemo(() => {
    const n = {};
    for (const p of inTab) for (const a of p.accords) n[a] = (n[a] || 0) + 1;
    return Object.keys(n).sort((a, b) => n[b] - n[a]);
  }, [inTab]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab
      .filter((p) => !accord || p.accords.includes(accord))
      .filter((p) => !needle || `${p.name} ${p.brand} ${p.accords.join(' ')}`.toLowerCase().includes(needle))
      .sort(SORTS[sort].fn);
  }, [inTab, q, accord, sort]);

  const changeTab = (k) => { setTab(k); setAccord(null); };
  const changeLayout = (v) => { setLayout(v); saveLayout(v); };
  const viewed = viewing && perfumes.find((p) => p.id === viewing);

  return (
    <div className="screen">
      <header className="screen__head row row--between">
        <h1>Colección</h1>
        {inTab.length > 0 && (
          <div className="layout-switch" role="group" aria-label="Vista">
            {LAYOUTS.map((l) => (
              <button key={l.id} className={layout === l.id ? 'on' : ''} onClick={() => changeLayout(l.id)}
                aria-label={l.label} aria-pressed={layout === l.id}>
                <Icon name={l.icon} size={18} />
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="segmented">
        {Object.entries(STATUSES).map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => changeTab(k)}>
            {label} <span className="count">{counts[k]}</span>
          </button>
        ))}
      </div>

      {inTab.length > 0 && (
        <>
          <div className="row">
            <label className="search grow">
              <Icon name="search" size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" enterKeyHint="search" />
              {q && <button className="search__clear" onClick={() => setQ('')} aria-label="Borrar búsqueda"><Icon name="x" size={16} /></button>}
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="select--auto" aria-label="Ordenar">
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </div>

          {accords.length > 1 && (
            <div className="scroller">
              {accords.map((a) => (
                <button key={a} className={`chip chip--color chip--dot ${accord === a ? 'chip--on' : ''}`}
                  style={{ '--c': accordColor(a) }} aria-pressed={accord === a}
                  onClick={() => setAccord(accord === a ? null : a)}>
                  {cap(a)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {inTab.length === 0 ? (
        <div className="empty">
          <Icon name="bottle" size={36} />
          <p>{EMPTY[tab]}</p>
          <button className="btn btn--primary" onClick={() => newPerfume(tab)}><Icon name="plus" size={18} /> Añadir perfume</button>
          {perfumes.length === 0 && (
            <button className="link" onClick={() => store.mergePerfumes(SAMPLES)}>o carga unos ejemplos para probar</button>
          )}
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>Nada coincide con la búsqueda.</p>
          <button className="link" onClick={() => { setQ(''); setAccord(null); }}>Quitar filtros</button>
        </div>
      ) : layout === 'shelf' ? (
        <Suspense fallback={<div className="shelf shelf--loading muted small">Montando la estantería…</div>}>
          <Shelf3D perfumes={list} onPick={(p) => setViewing(p.id)} />
        </Suspense>
      ) : layout === 'grid' ? (
        <ul className="pgrid">
          {list.map((p) => (
            <li key={p.id}>
              <button className="pcard" onClick={() => openPerfume(p.id)}>
                <Thumb perfume={p} size="fill" className="pcard__img" />
                <span className="pcard__body">
                  <strong>{p.name}</strong>
                  <span className="muted small">{p.brand || ' '}</span>
                  <AccordBar accords={p.accords} />
                  <span className="row row--between">
                    {p.rating > 0 ? <Stars value={p.rating} size={12} /> : <span />}
                    {p.wears?.length > 0 && <span className="muted tiny">{p.wears.length} usos</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="plist">
          {list.map((p) => (
            <li key={p.id}>
              <button className="plist__item" onClick={() => openPerfume(p.id)}>
                <Thumb perfume={p} />
                <span className="plist__body">
                  <strong>{p.name}</strong>
                  <span className="muted small">{p.brand}</span>
                  <span className="accords-mini">
                    {p.accords.slice(0, 3).map((a) => (
                      <span key={a}><i style={{ background: accordColor(a) }} />{cap(a)}</span>
                    ))}
                  </span>
                </span>
                <span className="plist__side">
                  {p.rating > 0 && <Stars value={p.rating} size={13} />}
                  {p.wears?.length > 0 && <span className="muted small">{p.wears.length} usos</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="fab" onClick={() => newPerfume(tab)} aria-label="Añadir perfume"><Icon name="plus" size={26} /></button>

      {viewed && (
        <Suspense fallback={<div className="viewer3d"><p className="viewer3d__msg muted">Cargando visor…</p></div>}>
          <Bottle3D
            perfume={viewed}
            onShapeChange={(shape) => store.savePerfume({ ...viewed, shape })}
            onClose={() => setViewing(null)}
            onOpenDetail={() => openPerfume(viewed.id)}
          />
        </Suspense>
      )}
    </div>
  );
}
