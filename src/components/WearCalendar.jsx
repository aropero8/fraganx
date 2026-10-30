import { useMemo, useState } from 'react';
import { todayKey } from '../lib/recommend.js';
import { cap, MOMENTS, OCCASION_EMOJI } from '../lib/constants.js';
import { Icon, Thumb } from './ui.jsx';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Días del mes en una rejilla que empieza en lunes; null para los huecos
function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const total = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  return [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => todayKey(new Date(year, month, i + 1))),
  ];
}

// Calendario desplegable con lo que te has puesto cada día
export default function WearCalendar({ perfumes, openPerfume }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(null);

  // { 'YYYY-MM-DD': [{ p, w }, …] }
  const byDay = useMemo(() => {
    const map = {};
    for (const p of perfumes) for (const w of p.wears || []) (map[w.date] ||= []).push({ p, w });
    return map;
  }, [perfumes]);

  const days = monthDays(cursor.year, cursor.month);
  const monthPrefix = todayKey(new Date(cursor.year, cursor.month, 1)).slice(0, 7);
  const wornThisMonth = Object.keys(byDay).filter((d) => d.startsWith(monthPrefix)).length;
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const title = cap(new Date(cursor.year, cursor.month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));

  const move = (delta) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
  };

  const today = todayKey();
  const picked = selected && byDay[selected];

  return (
    <details className="card wcal">
      <summary className="wcal__summary">
        <span className="grow">
          <span className="h3">Lo que me he puesto</span>
          <span className="small muted wcal__hint">
            {wornThisMonth ? `${wornThisMonth} ${wornThisMonth === 1 ? 'día' : 'días'} este mes` : 'Tu calendario de perfumes'}
          </span>
        </span>
        <span className="wcal__chevron"><Icon name="back" size={18} /></span>
      </summary>

      <div className="wcal__nav">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="Mes anterior"><Icon name="back" size={18} /></button>
        <strong>{title}</strong>
        <button className="icon-btn wcal__next" onClick={() => move(1)} disabled={isCurrentMonth} aria-label="Mes siguiente">
          <Icon name="back" size={18} />
        </button>
      </div>

      <div className="wcal__grid">
        {WEEKDAYS.map((d) => <span key={d} className="wcal__wd">{d}</span>)}
        {days.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const entries = byDay[day];
          const cls = ['wcal__day', entries && 'has', day === today && 'is-today', day === selected && 'on', day > today && 'is-future']
            .filter(Boolean).join(' ');
          return (
            <button
              key={day}
              className={cls}
              disabled={day > today}
              aria-pressed={day === selected}
              aria-label={entries ? `${day}: ${entries.map((e) => e.p.name).join(', ')}` : day}
              onClick={() => setSelected(day === selected ? null : day)}
            >
              {entries ? <Thumb perfume={entries[0].p} size="auto" className="wcal__thumb" /> : null}
              <span className="wcal__n">{Number(day.slice(8))}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="wcal__picked">
          <p className="label">
            {cap(new Date(selected + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}
          </p>
          {picked ? picked.map(({ p, w }) => (
            <button key={w.id} className="plist__item" onClick={() => openPerfume(p.id)}>
              <Thumb perfume={p} size={44} />
              <span className="plist__body">
                <strong>{p.name}</strong>
                <span className="small muted">
                  {[
                    p.brand,
                    w.occasion && `${OCCASION_EMOJI[w.occasion]} ${cap(w.occasion)}`,
                    w.moment && MOMENTS[w.moment],
                    w.temp != null && `${Math.round(w.temp)}°`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
              {w.feedback ? <span aria-label={w.feedback > 0 ? 'Me fue bien' : 'No acertó'}>{w.feedback > 0 ? '👍' : '👎'}</span> : null}
            </button>
          )) : <p className="small muted">Ese día no apuntaste ningún perfume.</p>}
        </div>
      )}
    </details>
  );
}
