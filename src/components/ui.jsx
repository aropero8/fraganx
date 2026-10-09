import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { accordColor, cap } from '../lib/constants.js';

export function Chips({ options, value = [], onChange, multi = true, small, ordered, colorOf }) {
  const toggle = (o) => {
    if (multi) onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
    else onChange(value === o ? null : o);
  };
  const isOn = (o) => (multi ? value.includes(o) : value === o);
  return (
    <div className={`chips ${small ? 'chips--small' : ''}`}>
      {options.map((o) => {
        const key = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? cap(o) : o.label;
        const on = isOn(key);
        return (
          <button
            type="button"
            key={key}
            className={`chip ${on ? 'chip--on' : ''} ${colorOf ? 'chip--color' : ''}`}
            style={colorOf ? { '--c': colorOf(key) } : undefined}
            aria-pressed={on}
            onClick={() => toggle(key)}
          >
            {ordered && on && <b className="chip__n">{value.indexOf(key) + 1}</b>}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 22 }) {
  if (!onChange) {
    // Solo lectura: sin botones, para poder ir dentro de tarjetas pulsables
    return (
      <span className="stars" style={{ fontSize: size }} role="img" aria-label={`${value} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`star ${value >= n ? 'star--full' : value >= n - 0.5 ? 'star--half' : ''}`}>★</span>
        ))}
      </span>
    );
  }
  return (
    <div className="stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const full = value >= n;
        const half = !full && value >= n - 0.5;
        return (
          <button
            type="button"
            key={n}
            disabled={!onChange}
            className={`star ${full ? 'star--full' : half ? 'star--half' : ''}`}
            onClick={() => onChange?.(value === n ? n - 0.5 : n)}
            aria-label={`${n} estrellas`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

// Tinta clara u oscura según lo claro que sea el color de fondo
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? 'rgba(29,20,11,.78)' : 'rgba(255,248,240,.92)';
}

export function accordGradient(accords = []) {
  const [a = '#d9a35f', b = a] = accords.slice(0, 2).map(accordColor);
  return { background: `linear-gradient(145deg, ${a}, ${b})`, color: inkFor(a) };
}

export function Thumb({ perfume, size = 56, className = '' }) {
  const style = typeof size === 'number' ? { width: size, height: size } : {};
  if (perfume.image) return <img className={`thumb ${className}`} src={perfume.image} alt="" style={style} />;
  const fontSize = typeof size === 'number' ? size * 0.46 : undefined;
  return (
    <span className={`thumb thumb--empty ${className}`} style={{ ...style, ...accordGradient(perfume.accords), fontSize }}>
      {((perfume.name || '').trim()[0] || '?').toUpperCase()}
    </span>
  );
}

export function Dots({ value, max = 5 }) {
  return (
    <span className="dots" aria-label={`${value} de ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? 'on' : ''} />
      ))}
    </span>
  );
}

export function AccordTags({ accords, max }) {
  return (
    <div className="tags">
      {accords.slice(0, max).map((a) => (
        <span key={a} className="tag tag--accord" style={{ '--c': accordColor(a) }}>{cap(a)}</span>
      ))}
    </div>
  );
}

// Barra con el peso de cada acorde: los primeros pesan más
export function AccordBar({ accords }) {
  if (!accords.length) return null;
  const weights = accords.map((_, i) => 1 / (i + 1) ** 0.6);
  return (
    <span className="accord-bar" aria-hidden="true">
      {accords.map((a, i) => (
        <i key={a} style={{ flexGrow: weights[i], background: accordColor(a) }} />
      ))}
    </span>
  );
}

const ICONS = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  bottle: <><rect x="9" y="2" width="6" height="3.5" rx="1" /><path d="M10.5 5.5v2M13.5 5.5v2" /><rect x="5.5" y="7.5" width="13" height="14.5" rx="3" /><rect x="9" y="12.5" width="6" height="4.5" rx="1" /></>,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  cube: <><path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" /><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
};

export function Icon({ name, size = 22 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// Avisos cortos abajo, con acción opcional ("Deshacer")
const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((text, action) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, action });
    timer.current = setTimeout(() => setToast(null), action ? 5000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button className="toast__action" onClick={() => { toast.action.onClick(); setToast(null); }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
