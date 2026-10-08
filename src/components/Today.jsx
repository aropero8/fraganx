import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { fetchWeather, getCurrentCoords, searchCity } from '../lib/weather.js';
import { recommend, todayKey, daysSince } from '../lib/recommend.js';
import { CONDITION_EMOJI, OCCASIONS } from '../lib/constants.js';
import { Chips, Thumb } from './ui.jsx';

export default function Today({ openPerfume }) {
  const store = useStore();
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
      setCityResults(await searchCity(cityQuery));
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

  const owned = perfumes.filter((p) => p.status === 'tengo').length;
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="screen">
      <header className="screen__head">
        <p className="eyebrow">{today}</p>
        <h1>¿Qué te pones hoy?</h1>
      </header>

      {!location ? (
        <section className="card">
          <h3>¿Dónde estás?</h3>
          <p className="muted">Uso el tiempo de tu zona para recomendarte.</p>
          <button className="btn btn--primary btn--block" onClick={useGps}>📍 Usar mi ubicación</button>
          <form className="row" onSubmit={findCity} style={{ marginTop: 12 }}>
            <input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="O busca tu ciudad…" />
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
        <section className="weather">
          {loading && !weather && <p className="muted">Mirando el cielo…</p>}
          {error && <p className="error">{error} <button className="link" onClick={() => load(location)}>Reintentar</button></p>}
          {weather && (
            <>
              <div className="weather__main">
                <span className="weather__temp">{weather.temp}°</span>
                <div>
                  <strong>{weather.label}</strong>
                  <p className="muted small">
                    {weather.min}° / {weather.max}° · sensación {weather.apparent}° · {weather.humidity}% hum.
                  </p>
                  <p className="muted small">{location.name}</p>
                </div>
              </div>
              <div className="weather__tags">
                {weather.conditions.map((c) => (
                  <span key={c} className="tag">{CONDITION_EMOJI[c]} {c}</span>
                ))}
                <span className="tag">🍂 {weather.season}</span>
              </div>
            </>
          )}
        </section>
      )}

      {pending.map(({ p, w }) => (
        <section key={w.id} className="card card--accent">
          <p className="small muted">El {new Date(w.date + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long' })} llevaste</p>
          <h3>{p.name}</h3>
          <p className="muted small">¿Qué tal te fue? Lo tendré en cuenta para días parecidos.</p>
          <div className="row">
            <button className="btn" onClick={() => store.rateWear(p.id, w.id, 1)}>👍 Bien</button>
            <button className="btn" onClick={() => store.rateWear(p.id, w.id, -1)}>👎 No acertó</button>
            <button className="btn btn--ghost" onClick={() => openPerfume(p.id, 'comment')}>Comentar</button>
          </div>
        </section>
      ))}

      <section>
        <p className="label">Ocasión</p>
        <Chips options={OCCASIONS} value={occasion} onChange={setOccasion} multi={false} />
      </section>

      {owned === 0 ? (
        <section className="empty">
          <p>Añade los perfumes que tienes en <b>Colección</b> y aquí te diré cuál ponerte.</p>
        </section>
      ) : (
        <section className="recs">
          {wornToday && (
            <p className="muted small">Hoy llevas <b>{wornToday.name}</b>.</p>
          )}
          {ranked.slice(0, showAll ? ranked.length : 3).map((r, i) => (
            <RecCard
              key={r.perfume.id}
              r={r}
              hero={i === 0}
              worn={wornToday?.id === r.perfume.id}
              onOpen={() => openPerfume(r.perfume.id)}
              onWear={() => store.logWear(r.perfume.id, { weather, occasion })}
            />
          ))}
          {ranked.length > 3 && (
            <button className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Ver menos' : `Ver los ${ranked.length} ordenados`}
            </button>
          )}
        </section>
      )}

      {location && (
        <button className="link small" onClick={() => store.setLocation(null)}>Cambiar ubicación</button>
      )}
    </div>
  );
}

function RecCard({ r, hero, worn, onOpen, onWear }) {
  const p = r.perfume;
  return (
    <article className={`rec ${hero ? 'rec--hero' : ''}`}>
      <div className="rec__top" onClick={onOpen}>
        <Thumb perfume={p} size={hero ? 72 : 52} />
        <div className="rec__title">
          {hero && <p className="eyebrow">Mi recomendación</p>}
          <h3>{p.name}</h3>
          <p className="muted small">{p.brand}</p>
        </div>
      </div>
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
