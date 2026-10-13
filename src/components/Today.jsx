import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { fetchWeather, getCurrentCoords, searchCity } from '../lib/weather.js';
import { recommend, todayKey, daysSince, defaultMoment } from '../lib/recommend.js';
import { cap, CONDITION_EMOJI, MOMENTS, OCCASION_EMOJI, OCCASIONS, SEASON_EMOJI } from '../lib/constants.js';
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
  const [moment, setMoment] = useState(defaultMoment); // por la tarde-noche, de noche
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

  const ranked = useMemo(() => recommend(perfumes, { weather, occasion, moment }), [perfumes, weather, occasion, moment]);

  const chooseOccasion = (o) => {
    setOccasion(o);
    if (o === 'noche') setMoment('noche');
  };

  // Lo que te has puesto hoy y lo pendiente de valorar
  const wornToday = perfumes.find((p) => p.wears?.some((w) => w.date === todayKey()));
  const pending = useMemo(() => {
    const list = [];
    for (const p of perfumes) for (const w of p.wears || []) {
      if (!w.feedback && w.date < todayKey() && daysSince(w.date) <= 7) list.push({ p, w });
    }
    return list.sort((a, b) => b.w.date.localeCompare(a.w.date)).slice(0, 1);
  }, [perfumes]);

  const todayWear = (p) => p.wears?.find((w) => w.date === todayKey());
  // Lo que llevas hoy arriba; el resto, debajo
  const others = wornToday ? ranked.filter((r) => r.perfume.id !== wornToday.id) : ranked;

  // Cambiar de perfume sustituye al de hoy en vez de sumar otro
  const wear = (p) => {
    const prev = wornToday && wornToday.id !== p.id ? wornToday : null;
    if (prev) store.undoWear(prev.id, todayWear(prev).id);
    const wearId = store.logWear(p.id, { weather, occasion, moment });
    toast(`Apuntado: hoy llevas ${p.name}`, {
      label: 'Deshacer',
      onClick: () => {
        store.undoWear(p.id, wearId);
        if (prev) store.logWear(prev.id, { weather, occasion, moment });
      },
    });
  };

  const unwear = (p) => {
    store.undoWear(p.id, todayWear(p).id);
    toast(`Quitado ${p.name} de hoy`, { label: 'Deshacer', onClick: () => store.logWear(p.id, { weather, occasion, moment }) });
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
                    {weather.min}° / {weather.max}° · sensación {weather.apparent}°
                    {weather.night != null && ` · noche ${weather.night}°`} · {weather.humidity}% hum.
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
        <p className="label">¿Para cuándo?</p>
        <div className="segmented segmented--small">
          {Object.entries(MOMENTS).map(([k, label]) => (
            <button key={k} className={moment === k ? 'on' : ''} aria-pressed={moment === k} onClick={() => setMoment(k)}>{label}</button>
          ))}
        </div>
      </section>

      <section>
        <p className="label">Ocasión</p>
        <Chips options={OCCASION_OPTIONS} value={occasion} onChange={chooseOccasion} multi={false} />
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
            <>
              <WornCard
                perfume={wornToday}
                onOpen={() => openPerfume(wornToday.id)}
                onUndo={() => unwear(wornToday)}
              />
              {others.length > 0 && <p className="label recs__label">Si te apetece cambiar</p>}
            </>
          )}
          {others.slice(0, showAll ? others.length : 3).map((r, i) => (
            <RecCard
              key={r.perfume.id}
              r={r}
              hero={!wornToday && i === 0}
              onOpen={() => openPerfume(r.perfume.id)}
              onWear={() => wear(r.perfume)}
            />
          ))}
          {others.length > 3 && (
            <button className="btn btn--ghost btn--block" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Ver menos' : `Ver los ${others.length} ordenados`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function WornCard({ perfume: p, onOpen, onUndo }) {
  return (
    <article className="rec rec--hero rec--worn">
      <button className="rec__top" onClick={onOpen}>
        <Thumb perfume={p} size={104} />
        <span className="rec__title">
          <span className="eyebrow">✓ Hoy llevas</span>
          <span className="h3">{p.name}</span>
          <span className="muted small">{p.brand}</span>
          <AccordBar accords={p.accords} />
        </span>
      </button>
      <button className="link link--muted small rec__undo" onClick={onUndo}>No, hoy no lo llevo</button>
    </article>
  );
}

function RecCard({ r, hero, onOpen, onWear }) {
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
      <button className={`btn ${hero ? 'btn--primary' : ''} btn--block`} onClick={onWear}>
        Me lo pongo hoy
      </button>
    </article>
  );
}
