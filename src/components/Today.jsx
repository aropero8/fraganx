import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { fetchWeather, getCurrentCoords, searchCity } from '../lib/weather.js';
import { recommend, todayKey, daysSince } from '../lib/recommend.js';
import { cap, CONDITION_EMOJI, OCCASION_EMOJI, OCCASIONS, SEASON_EMOJI } from '../lib/constants.js';
import { AccordBar, Chips, Icon, Thumb, useToast } from './ui.jsx';

const OCCASION_OPTIONS = OCCASIONS.map((o) => ({ value: o, label: `${OCCASION_EMOJI[o]} ${cap(o)}` }));

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Today({ openPerfume, goCollection }) {
  const store = useStore();
  const toast = useToast();
  const { perfumes, location } = store;
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [occasion, setOccasion] = useState(null);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState([]);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (loc) => {
    setLoading(true);
    setError('');
    try {
      setWeather(await fetchWeather(loc));
    } catch (e) {
      setError(e.message || 'Error al cargar el tiempo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location) load(location);
  }, [location, load]);

  const useGps = async () => {
    setError('');
    try {
      store.setLocation(await getCurrentCoords());
    } catch {
      setError('No pude acceder a tu ubicación. Busca tu ciudad.');
    }
  };

  const findCity = async (e) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;
    try {
      const results = await searchCity(cityQuery);
      setCityResults(results);
      if (!results.length) setError('No encontré esa ciudad.');
    } catch (err) {
      setError(err.message);
    }
  };

  const ranked = useMemo(() => recommend(perfumes, { weather, occasion }), [perfumes, weather, occasion]);

  // Lo que te has puesto hoy y lo pendiente de valorar
  const wornToday = perfumes.find((p) => p.wears?.some((w) => w.date === todayKey()));
  const pending = useMemo(() => {
    const list = [];
    for (const p of perfumes) for (const w of p.wears || []) {
      if (!w.feedback && w.date < todayKey() && daysSince(w.date) <= 7) list.push({ p, w });
    }
    return list.sort((a, b) => b.w.date.localeCompare(a.w.date)).slice(0, 1);
  }, [perfumes]);

  const wear = (p) => {
    const wearId = store.logWear(p.id, { weather, occasion });
    toast(`Apuntado: hoy llevas ${p.name}`, { label: 'Deshacer', onClick: () => store.undoWear(p.id, wearId) });
  };

  const rate = (p, w, value) => {
    store.rateWear(p.id, w.id, value);
    toast('Gracias, lo tendré en cuenta para días parecidos');
  };

  const owned = perfumes.filter((p) => p.status === 'tengo').length;
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const mood = weather && (weather.conditions.includes('lluvia') ? 'lluvia' : weather.conditions[0]);

  return (
    <div className="screen">
      <header className="screen__head">
        <p className="eyebrow">{greeting()} · {today}</p>
        <h1>¿Qué te pones hoy?</h1>
      </header>

      {!location ? (
        <section className="card">
          <h3>¿Dónde estás?</h3>
          <p className="muted">Uso el tiempo de tu zona para recomendarte.</p>
          <button className="btn btn--primary btn--block" onClick={useGps}><Icon name="pin" size={18} /> Usar mi ubicación</button>
          <form className="row" onSubmit={findCity} style={{ marginTop: 4 }}>
            <input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="O busca tu ciudad…" enterKeyHint="search" />
            <button className="btn">Buscar</button>
          </form>
          {cityResults.map((c) => (
            <button key={`${c.lat},${c.lon}`} className="list-btn" onClick={() => { store.setLocation(c); setCityResults([]); }}>
              {c.name}
            </button>
          ))}
          {error && <p className="error">{error}</p>}
        </section>
      ) : (
        <section className={`weather ${mood ? `weather--${mood}` : ''}`}>
          {loading && !weather && <div className="weather__main"><span className="skeleton skeleton--temp" /><span className="skeleton skeleton--text" /></div>}
          {error && <p className="error">{error} <button className="link" onClick={() => load(location)}>Reintentar</button></p>}
          {weather && (
            <>
              <div className="weather__main">
                <span className="weather__temp">{weather.temp}°</span>
                <div className="grow">
                  <strong>{weather.label}</strong>
                  <p className="small weather__meta">
                    {weather.min}° / {weather.max}° · sensación {weather.apparent}° · {weather.humidity}% hum.
                  </p>
                </div>
              </div>
              <div className="weather__tags">
                {weather.conditions.map((c) => (
                  <span key={c} className="tag">{CONDITION_EMOJI[c]} {cap(c)}</span>
                ))}
                <span className="tag">{SEASON_EMOJI[weather.season]} {cap(weather.season)}</span>
              </div>
            </>
          )}
          <button className="weather__place" onClick={() => store.setLocation(null)} aria-label="Cambiar ubicación">
            <Icon name="pin" size={14} /> {location.name.split(',')[0]} · cambiar
          </button>
        </section>
      )}

      {pending.map(({ p, w }) => (
        <section key={w.id} className="card card--ask">
          <div className="row">
            <Thumb perfume={p} size={44} />
            <div className="grow">
              <p className="small muted">El {new Date(w.date + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long' })} llevaste</p>
              <h3>{p.name}</h3>
            </div>
          </div>
          <p className="muted small">¿Qué tal te fue? Lo tendré en cuenta para días parecidos.</p>
          <div className="row">
            <button className="btn grow" onClick={() => rate(p, w, 1)}>👍 Bien</button>
            <button className="btn grow" onClick={() => rate(p, w, -1)}>👎 No acertó</button>
            <button className="btn btn--ghost" onClick={() => openPerfume(p.id, 'comment')}>Comentar</button>
          </div>
        </section>
      ))}

      <section>
        <p className="label">Ocasión</p>
        <Chips options={OCCASION_OPTIONS} value={occasion} onChange={setOccasion} multi={false} />
      </section>

      {owned === 0 ? (
        <section className="empty">
          <Icon name="bottle" size={36} />
          <p>Añade los perfumes que tienes y aquí te diré cuál ponerte según el tiempo y la ocasión.</p>
          <button className="btn btn--primary" onClick={goCollection}>Añadir mis perfumes</button>
        </section>
      ) : (
        <section className="recs">
          {wornToday && (
            <p className="worn-today small"><Thumb perfume={wornToday} size={24} /> Hoy llevas <b>{wornToday.name}</b></p>
          )}
          {ranked.slice(0, showAll ? ranked.length : 3).map((r, i) => (
            <RecCard
              key={r.perfume.id}
              r={r}
              hero={i === 0}
              worn={wornToday?.id === r.perfume.id}
              onOpen={() => openPerfume(r.perfume.id)}
              onWear={() => wear(r.perfume)}
            />
          ))}
          {ranked.length > 3 && (
            <button className="btn btn--ghost btn--block" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Ver menos' : `Ver los ${ranked.length} ordenados`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function RecCard({ r, hero, worn, onOpen, onWear }) {
  const p = r.perfume;
  return (
    <article className={`rec ${hero ? 'rec--hero' : ''}`}>
      <button className="rec__top" onClick={onOpen}>
        <Thumb perfume={p} size={hero ? 76 : 52} />
        <span className="rec__title">
          {hero && <span className="eyebrow">Mi recomendación</span>}
          <span className="h3">{p.name}</span>
          <span className="muted small">{p.brand}</span>
          <AccordBar accords={p.accords} />
        </span>
      </button>
      <ul className="reasons">
        {r.reasons.map((x, i) => (
          <li key={i} className={x.w < 0 ? 'con' : 'pro'}>{x.text}</li>
        ))}
      </ul>
      <button className={`btn ${hero ? 'btn--primary' : ''} btn--block`} onClick={onWear} disabled={worn}>
        {worn ? '✓ Lo llevas hoy' : 'Me lo pongo hoy'}
      </button>
    </article>
  );
}
