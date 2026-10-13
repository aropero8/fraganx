import { accordColor, cap } from '../lib/constants.js';
import { mapAccord } from '../lib/fragrantica.js';
import { noteStyle, splitNotes } from '../lib/notes.js';

// Tinta clara u oscura según lo claro que sea el color de fondo
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? 'rgba(29,20,11,.85)' : 'rgba(255,248,240,.95)';
}

// Acordes de Fragrantica que caen en la misma familia que otro pero allí tienen su propio color
const TINTS = { 'fresco especiado': '#8fbf4a', 'fresh spicy': '#8fbf4a' };

// Acordes como en Fragrantica: una barra por acorde, de más a menos intenso.
// El texto copiado no trae la intensidad, solo el orden: el ancho se estima por la posición.
export function AccordBars({ perfume }) {
  const named = perfume.fragranticaAccords?.length ? perfume.fragranticaAccords : perfume.accords;
  if (!named.length) return null;
  return (
    <ul className="accord-bars">
      {named.map((name, i) => {
        const color = TINTS[name] || accordColor(mapAccord(name));
        return (
          <li key={name}>
            <span style={{ width: `${Math.max(42, 100 - i * 9)}%`, background: color, color: inkFor(color) }}>{name}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Votaciones de la comunidad de Fragrantica, de menos a más (las horas son las que da Fragrantica)
export const LONGEVITY_VOTES = [
  ['Escasa', 'menos de 1 h'], ['Débil', '1-2 h'], ['Moderada', '3-6 h'], ['Duradera', '7-12 h'], ['Muy duradera', 'más de 12 h'],
];
export const SILLAGE_VOTES = [
  ['Suave', 'pegada a la piel'], ['Moderada', 'a un brazo'], ['Pesada', 'a un par de metros'], ['Enorme', 'llena la habitación'],
];

// Una barra por opción, como en Fragrantica; la más votada, resaltada
export function VoteBars({ title, options, votes }) {
  const total = (votes || []).reduce((s, v) => s + v, 0);
  if (!total) return null;
  const top = votes.indexOf(Math.max(...votes));
  return (
    <section className="votes">
      <header className="row row--between">
        <h4>{title}</h4>
        <b className="value">{options[top][0]}</b>
      </header>
      <ul>
        {options.map(([label, hint], i) => (
          <li key={label} className={i === top ? 'is-top' : ''}>
            <span className="votes__label">{label}<small>{hint}</small></span>
            <span className="votes__track"><span style={{ width: `${(votes[i] / votes[top]) * 100}%` }} /></span>
            <span className="votes__n">{Math.round((votes[i] / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const LEVELS = [
  { key: 'top', label: 'Notas de salida', hint: 'Lo primero que hueles, los primeros minutos' },
  { key: 'heart', label: 'Notas de corazón', hint: 'El carácter del perfume, tras la primera media hora' },
  { key: 'base', label: 'Notas de fondo', hint: 'Lo que queda en la piel al final del día' },
];

// Pirámide olfativa con cada nota por separado, con el color y el icono de su familia
export function NotePyramid({ notes }) {
  const levels = LEVELS.map((l) => ({ ...l, list: splitNotes(notes?.[l.key]) })).filter((l) => l.list.length);
  if (!levels.length) return null;
  // Con solo salida rellena, el perfume no tiene pirámide: se muestran sus notas sin niveles
  const flat = levels.length === 1 && levels[0].key === 'top' && !notes.heart && !notes.base;
  return (
    <div className="pyramid">
      {levels.map((l) => (
        <section key={l.key} className="pyramid__level">
          {!flat && (
            <header>
              <h4>{l.label}</h4>
              <p className="muted tiny">{l.hint}</p>
            </header>
          )}
          <ul className="notes">
            {l.list.map((n) => {
              const s = noteStyle(n);
              return (
                <li key={n} title={s.family ? cap(s.family) : undefined}>
                  <span className="notes__icon" style={{ '--c': s.color }} aria-hidden="true">{s.emoji}</span>
                  <span className="notes__name">{n}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
