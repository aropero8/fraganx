export function Chips({ options, value = [], onChange, multi = true, small }) {
  const toggle = (o) => {
    if (multi) onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
    else onChange(value === o ? null : o);
  };
  const isOn = (o) => (multi ? value.includes(o) : value === o);
  return (
    <div className={`chips ${small ? 'chips--small' : ''}`}>
      {options.map((o) => {
        const key = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <button type="button" key={key} className={`chip ${isOn(key) ? 'chip--on' : ''}`} onClick={() => toggle(key)}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 22 }) {
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

export function Thumb({ perfume, size = 56 }) {
  const initials = (perfume.brand || perfume.name || '?').slice(0, 2).toUpperCase();
  return perfume.image ? (
    <img className="thumb" src={perfume.image} alt="" style={{ width: size, height: size }} />
  ) : (
    <div className="thumb thumb--empty" style={{ width: size, height: size, fontSize: size * 0.32 }}>
      {initials}
    </div>
  );
}

export function Dots({ value, max = 5 }) {
  return (
    <span className="dots">
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? 'on' : ''} />
      ))}
    </span>
  );
}
