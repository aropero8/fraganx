import { useEffect, useRef } from 'react';
import { SHELF_BACKS, SHELF_LIGHTS, SHELF_MATERIALS } from '../lib/shelfStyles.js';

// Panel inferior para elegir material, fondo y luz de la estantería. Los cambios se ven al momento.
function Swatches({ options, value, onChange, swatchOf }) {
  const ref = useRef(null);
  // Al abrir, la opción elegida a la vista (la fila tiene scroll lateral)
  useEffect(() => {
    const row = ref.current;
    const on = row.querySelector('.on');
    if (on) row.scrollLeft = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }, []);
  return (
    <div className="swatches" ref={ref}>
      {Object.entries(options).map(([k, o]) => (
        <button key={k} type="button" className={`swatch ${value === k ? 'on' : ''}`} aria-pressed={value === k} onClick={() => onChange(k)}>
          <i style={{ background: swatchOf(k, o) }} />
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ShelfCustomizer({ title, value, onChange, onApplyAll, onClose }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const material = SHELF_MATERIALS[value.material];

  return (
    <div className="sheet" role="dialog" aria-label={title}>
      <button className="sheet__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="sheet__panel">
        <header className="row row--between">
          <strong>{title}</strong>
          <button className="link link--strong" onClick={onClose}>Listo</button>
        </header>

        <span className="label">Material</span>
        <Swatches options={SHELF_MATERIALS} value={value.material} onChange={(v) => set('material', v)} swatchOf={(_, o) => o.swatch} />

        <span className="label">Fondo</span>
        <Swatches options={SHELF_BACKS} value={value.back} onChange={(v) => set('back', v)}
          swatchOf={(_, o) => o.color || material.swatch} />

        <span className="label">Luz</span>
        <Swatches options={SHELF_LIGHTS} value={value.light} onChange={(v) => set('light', v)}
          swatchOf={(_, o) => (o.color ? `radial-gradient(circle, #fff 0 20%, ${o.color} 60%)` : 'var(--surface-2)')} />

        <button className="btn btn--block" onClick={() => { onApplyAll(value); onClose(); }}>Usar en las tres estanterías</button>
      </div>
    </div>
  );
}
