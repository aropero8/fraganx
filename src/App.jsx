import { useEffect, useState } from 'react';
import { useStore, newPerfume } from './lib/store.jsx';
import Today from './components/Today.jsx';
import Collection from './components/Collection.jsx';
import PerfumeDetail from './components/PerfumeDetail.jsx';
import PerfumeForm from './components/PerfumeForm.jsx';
import Settings from './components/Settings.jsx';

const TABS = [
  { id: 'today', label: 'Hoy', icon: '☀︎' },
  { id: 'collection', label: 'Colección', icon: '◈' },
  { id: 'settings', label: 'Ajustes', icon: '⚙︎' },
];

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState('today');
  // view: null | { type: 'detail', id, focus } | { type: 'form', perfume, returnTo }
  const [view, setView] = useState(null);

  // Botón "atrás" de Android: cierra la vista abierta en vez de salir
  useEffect(() => {
    if (!view) return;
    history.pushState({ v: 1 }, '');
    const onPop = () => setView(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [view?.type, view?.id]);

  useEffect(() => { window.scrollTo(0, 0); }, [tab, view?.type]);

  if (!store.ready) return <div className="splash">Perfumario</div>;

  const openPerfume = (id, focus) => setView({ type: 'detail', id, focus });

  let content;
  if (view?.type === 'form') {
    content = (
      <PerfumeForm
        initial={view.perfume}
        onCancel={() => setView(view.returnTo || null)}
        onSave={(p) => { store.savePerfume(p); setView({ type: 'detail', id: p.id }); }}
      />
    );
  } else if (view?.type === 'detail') {
    const p = store.perfumes.find((x) => x.id === view.id);
    content = (
      <PerfumeDetail
        id={view.id}
        focus={view.focus}
        onBack={() => setView(null)}
        onEdit={() => setView({ type: 'form', perfume: p, returnTo: view })}
      />
    );
  } else if (tab === 'today') {
    content = <Today openPerfume={openPerfume} />;
  } else if (tab === 'collection') {
    content = <Collection openPerfume={openPerfume} newPerfume={(status) => setView({ type: 'form', perfume: newPerfume({ status }) })} />;
  } else {
    content = <Settings />;
  }

  return (
    <div className="app">
      <main>{content}</main>
      {!view && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <span className="tabbar__icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
