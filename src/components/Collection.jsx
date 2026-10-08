import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { STATUSES } from '../lib/constants.js';
import { Stars, Thumb } from './ui.jsx';

const SORTS = {
  recent: { label: 'Recientes', fn: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  rating: { label: 'Valoración', fn: (a, b) => (b.rating || 0) - (a.rating || 0) },
  name: { label: 'Nombre', fn: (a, b) => a.name.localeCompare(b.name) },
  worn: { label: 'Más usados', fn: (a, b) => (b.wears?.length || 0) - (a.wears?.length || 0) },
};

export default function Collection({ openPerfume, newPerfume }) {
  const { perfumes } = useStore();
  const [tab, setTab] = useState('tengo');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');

  const counts = useMemo(
    () => Object.fromEntries(Object.keys(STATUSES).map((s) => [s, perfumes.filter((p) => p.status === s).length])),
    [perfumes],
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return perfumes
      .filter((p) => p.status === tab)
      .filter((p) => !needle || `${p.name} ${p.brand} ${p.accords.join(' ')}`.toLowerCase().includes(needle))
      .sort(SORTS[sort].fn);
  }, [perfumes, tab, q, sort]);

  return (
    <div className="screen">
      <header className="screen__head">
        <h1>Colección</h1>
      </header>

      <div className="segmented">
        {Object.entries(STATUSES).map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label} <span className="count">{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, marca o acorde…" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 'auto' }}>
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <p>{q ? 'Nada coincide con la búsqueda.' : 'Aquí no hay nada todavía.'}</p>
        </div>
      ) : (
        <ul className="plist">
          {list.map((p) => (
            <li key={p.id} onClick={() => openPerfume(p.id)}>
              <Thumb perfume={p} />
              <div className="plist__body">
                <strong>{p.name}</strong>
                <span className="muted small">{p.brand}</span>
                <span className="accords-mini">{p.accords.slice(0, 3).join(' · ')}</span>
              </div>
              <div className="plist__side">
                {p.rating > 0 && <Stars value={p.rating} size={13} />}
                {p.wears?.length > 0 && <span className="muted small">{p.wears.length} usos</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <button className="fab" onClick={() => newPerfume(tab)} aria-label="Añadir perfume">＋</button>
    </div>
  );
}
