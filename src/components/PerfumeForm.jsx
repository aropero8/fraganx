import { useState } from 'react';
import { ACCORDS, OCCASIONS, SEASONS, STATUSES } from '../lib/constants.js';
import { Chips, Stars } from './ui.jsx';

// Reduce la foto para no llenar el almacenamiento
function resizeImage(file, max = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = img.width * scale;
        c.height = img.height * scale;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PerfumeForm({ initial, onSave, onCancel }) {
  const [p, setP] = useState(initial);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setNote = (k, v) => setP((x) => ({ ...x, notes: { ...x.notes, [k]: v } }));

  const submit = (e) => {
    e.preventDefault();
    if (!p.name.trim()) return;
    onSave({ ...p, name: p.name.trim(), brand: p.brand.trim() });
  };

  return (
    <form className="screen form" onSubmit={submit}>
      <header className="topbar">
        <button type="button" className="link" onClick={onCancel}>Cancelar</button>
        <strong>{initial.name ? 'Editar' : 'Nuevo perfume'}</strong>
        <button className="link link--strong" disabled={!p.name.trim()}>Guardar</button>
      </header>

      <div className="photo-row">
        <label className="photo">
          {p.image ? <img src={p.image} alt="" /> : <span>📷<br />Foto</span>}
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) set('image', await resizeImage(f));
          }} />
        </label>
        <div className="grow">
          <label className="field">
            <span>Nombre *</span>
            <input value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Terre d'Hermès" autoFocus />
          </label>
          <label className="field">
            <span>Marca</span>
            <input value={p.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Ej. Hermès" />
          </label>
        </div>
      </div>

      <label className="field">
        <span>Estado</span>
        <Chips
          options={Object.entries(STATUSES).map(([value, label]) => ({ value, label }))}
          value={p.status}
          onChange={(v) => v && set('status', v)}
          multi={false}
        />
      </label>

      {p.status === 'tuve' && (
        <label className="field">
          <span>¿Por qué ya no lo tienes?</span>
          <input value={p.leftReason} onChange={(e) => set('leftReason', e.target.value)} placeholder="Se acabó, lo vendí, me cansó…" />
        </label>
      )}

      <div className="field">
        <span>Acordes principales <em className="muted">(en orden, los 2 primeros pesan más en la descripción)</em></span>
        <Chips options={Object.keys(ACCORDS)} value={p.accords} onChange={(v) => set('accords', v)} small />
      </div>

      <div className="field">
        <span>Estaciones</span>
        <Chips options={SEASONS} value={p.seasons} onChange={(v) => set('seasons', v)} />
      </div>

      <div className="field">
        <span>Ocasiones</span>
        <Chips options={OCCASIONS} value={p.occasions} onChange={(v) => set('occasions', v)} />
      </div>

      <div className="grid2">
        <label className="field">
          <span>Proyección: {p.intensity}/5</span>
          <input type="range" min="1" max="5" value={p.intensity} onChange={(e) => set('intensity', +e.target.value)} />
        </label>
        <label className="field">
          <span>Duración: {p.longevity}/5</span>
          <input type="range" min="1" max="5" value={p.longevity} onChange={(e) => set('longevity', +e.target.value)} />
        </label>
      </div>

      <div className="field">
        <span>Tu valoración</span>
        <Stars value={p.rating} onChange={(v) => set('rating', v)} size={28} />
      </div>

      <fieldset className="field">
        <span>Pirámide olfativa</span>
        <input value={p.notes.top} onChange={(e) => setNote('top', e.target.value)} placeholder="Salida" />
        <input value={p.notes.heart} onChange={(e) => setNote('heart', e.target.value)} placeholder="Corazón" />
        <input value={p.notes.base} onChange={(e) => setNote('base', e.target.value)} placeholder="Fondo" />
      </fieldset>

      <div className="grid2">
        <label className="field">
          <span>Tamaño (ml)</span>
          <input inputMode="numeric" value={p.sizeMl} onChange={(e) => set('sizeMl', e.target.value)} />
        </label>
        <label className="field">
          <span>Precio (€)</span>
          <input inputMode="decimal" value={p.price} onChange={(e) => set('price', e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Enlace de Fragrantica</span>
        <input type="url" value={p.fragranticaUrl} onChange={(e) => set('fragranticaUrl', e.target.value)} placeholder="https://www.fragrantica.es/perfume/…" />
      </label>

      <button className="btn btn--primary btn--block" disabled={!p.name.trim()}>Guardar</button>
    </form>
  );
}
