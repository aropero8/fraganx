import { useState } from 'react';
import {
  accordColor, ACCORDS, cap, DEFAULT_SHAPE, OCCASION_EMOJI, OCCASIONS, SEASON_EMOJI, SEASONS, SHAPES, STATUSES,
} from '../lib/constants.js';
import { parseFragrantica } from '../lib/fragrantica.js';
import { isGlb, saveModel } from '../lib/modelStore.js';
import { Chips, Icon, Stars, useToast } from './ui.jsx';

const INTENSITY = ['Íntima', 'Suave', 'Moderada', 'Fuerte', 'Enorme'];
const LONGEVITY = ['Muy corta', 'Corta', 'Media', 'Larga', 'Eterna'];
const SEASON_OPTIONS = SEASONS.map((s) => ({ value: s, label: `${SEASON_EMOJI[s]} ${cap(s)}` }));
const OCCASION_OPTIONS = OCCASIONS.map((o) => ({ value: o, label: `${OCCASION_EMOJI[o]} ${cap(o)}` }));

// Reduce la foto para no llenar el almacenamiento
// (600 px: suficiente para la miniatura y para la textura del modelo 3D)
function resizeImage(file, max = 600) {
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

const FIELD_LABELS = { name: 'nombre', brand: 'marca', accords: 'acordes', notes: 'notas', seasons: 'estaciones', occasions: 'ocasiones', fragranticaUrl: 'enlace' };

// Pegar el enlace o el texto copiado de la ficha de Fragrantica (seleccionar todo → copiar)
function FragranticaFill({ onFill }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const toast = useToast();

  const fill = () => {
    const data = parseFragrantica(text);
    const keys = Object.keys(data);
    if (!keys.length) return toast('No encuentro datos de Fragrantica en ese texto.');
    onFill(data);
    setText('');
    setOpen(false);
    toast(`Rellenado: ${keys.map((k) => FIELD_LABELS[k]).join(', ')}. Revisa que esté bien.`);
  };

  if (!open) {
    return <button type="button" className="btn btn--block" onClick={() => setOpen(true)}>Rellenar desde Fragrantica</button>;
  }
  return (
    <section className="card">
      <h3>Rellenar desde Fragrantica</h3>
      <p className="muted small">
        Abre la ficha del perfume en Fragrantica, selecciona todo, copia y pégalo aquí.
        Con solo el enlace se rellenan el nombre y la marca.
      </p>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus
        placeholder="https://www.fragrantica.es/perfume/… o el texto de la página" />
      <div className="row">
        <button type="button" className="btn btn--primary" disabled={!text.trim()} onClick={fill}>Rellenar</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </section>
  );
}

function PhotoInput({ value, onChange, label, small }) {
  return (
    <label className={`photo ${small ? 'photo--small' : ''}`}>
      {value ? <img src={value} alt="" /> : <span><Icon name="plus" size={small ? 18 : 24} /><br />{label}</span>}
      {value && <span className="photo__edit">Cambiar</span>}
      <input type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) onChange(await resizeImage(f));
      }} />
    </label>
  );
}

export default function PerfumeForm({ initial, onSave, onCancel }) {
  const [p, setP] = useState(initial);
  const toast = useToast();
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setNote = (k, v) => setP((x) => ({ ...x, notes: { ...x.notes, [k]: v } }));

  // Sin "accept": en Android el selector no reconoce la extensión .glb y no dejaría elegir el archivo
  const importModel = async (file) => {
    const buffer = await file.arrayBuffer();
    if (!isGlb(buffer)) return toast('Ese archivo no es un modelo 3D .glb.');
    try {
      const modelKey = await saveModel(buffer);
      setP((x) => ({ ...x, modelKey, modelName: file.name }));
      const mb = buffer.byteLength / 1e6;
      toast(mb > 25 ? `Modelo importado. Pesa ${Math.round(mb)} MB: puede ir lento en la estantería.` : 'Modelo importado.');
    } catch {
      toast('No pude guardar el modelo en el móvil.');
    }
  };

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

      <FragranticaFill onFill={(data) => setP((x) => ({ ...x, ...data }))} />

      <div className="photo-row">
        <PhotoInput value={p.image} onChange={(v) => set('image', v)} label="Foto" />
        <div className="grow">
          <label className="field">
            <span>Nombre *</span>
            <input value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Terre d'Hermès" autoFocus={!initial.name} autoCapitalize="words" />
          </label>
          <label className="field">
            <span>Marca</span>
            <input value={p.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Ej. Hermès" autoCapitalize="words" />
          </label>
        </div>
      </div>

      <div className="field">
        <span>Estado</span>
        <div className="segmented">
          {Object.entries(STATUSES).map(([k, label]) => (
            <button type="button" key={k} className={p.status === k ? 'on' : ''} onClick={() => set('status', k)}>{label}</button>
          ))}
        </div>
      </div>

      {p.status === 'tuve' && (
        <label className="field">
          <span>¿Por qué ya no lo tienes?</span>
          <input value={p.leftReason} onChange={(e) => set('leftReason', e.target.value)} placeholder="Se acabó, lo vendí, me cansó…" />
        </label>
      )}

      <section className="card">
        <h3>Perfil olfativo</h3>
        <div className="field">
          <span>Acordes principales <em className="muted">· tócalos por orden de importancia</em></span>
          <Chips options={Object.keys(ACCORDS)} value={p.accords} onChange={(v) => set('accords', v)} small ordered colorOf={accordColor} />
        </div>
        <fieldset className="field">
          <span>Pirámide olfativa</span>
          <input value={p.notes.top} onChange={(e) => setNote('top', e.target.value)} placeholder="Salida · Ej. bergamota, pomelo" />
          <input value={p.notes.heart} onChange={(e) => setNote('heart', e.target.value)} placeholder="Corazón · Ej. pimienta, geranio" />
          <input value={p.notes.base} onChange={(e) => setNote('base', e.target.value)} placeholder="Fondo · Ej. vetiver, cedro" />
        </fieldset>
      </section>

      <section className="card">
        <h3>Cuándo llevarlo</h3>
        <div className="field">
          <span>Estaciones</span>
          <Chips options={SEASON_OPTIONS} value={p.seasons} onChange={(v) => set('seasons', v)} />
        </div>
        <div className="field">
          <span>Ocasiones</span>
          <Chips options={OCCASION_OPTIONS} value={p.occasions} onChange={(v) => set('occasions', v)} />
        </div>
      </section>

      <section className="card">
        <h3>Cómo se comporta</h3>
        <label className="field">
          <span className="row row--between">Proyección <b className="value">{INTENSITY[p.intensity - 1]}</b></span>
          <input type="range" min="1" max="5" value={p.intensity} onChange={(e) => set('intensity', +e.target.value)} />
        </label>
        <label className="field">
          <span className="row row--between">Duración <b className="value">{LONGEVITY[p.longevity - 1]}</b></span>
          <input type="range" min="1" max="5" value={p.longevity} onChange={(e) => set('longevity', +e.target.value)} />
        </label>
        <div className="field">
          <span>Tu valoración <em className="muted">· toca dos veces para media estrella</em></span>
          <Stars value={p.rating} onChange={(v) => set('rating', v)} size={30} />
        </div>
      </section>

      <section className="card">
        <h3>Modelo 3D</h3>
        {p.modelKey ? (
          <div className="row row--between">
            <span className="small">Usando tu modelo <b>{p.modelName || '.glb'}</b></span>
            <button type="button" className="link link--muted small" onClick={() => setP((x) => ({ ...x, modelKey: '', modelName: '' }))}>Quitar</button>
          </div>
        ) : p.image ? (
          <>
            <p className="muted small">Se crea con las fotos. Mejor de frente, con el frasco entero y sobre un fondo liso.</p>
            <div className="photo-row">
              <PhotoInput value={p.backImage} onChange={(v) => set('backImage', v)} label="Detrás" small />
              <div className="grow">
                <span className="label">Forma del frasco</span>
                <Chips
                  options={Object.entries(SHAPES).map(([value, s]) => ({ value, label: s.label }))}
                  value={p.shape || DEFAULT_SHAPE}
                  onChange={(v) => v && set('shape', v)}
                  multi={false}
                />
                {p.backImage && <button type="button" className="link link--muted small" onClick={() => set('backImage', '')}>Quitar foto de detrás</button>}
              </div>
            </div>
          </>
        ) : (
          <p className="muted small">Sin foto se usa un frasco genérico. Añade una foto arriba o importa un modelo 3D.</p>
        )}
        <label className="btn btn--block">
          <Icon name="cube" size={18} /> {p.modelKey ? 'Cambiar modelo 3D' : 'Importar modelo 3D (.glb)'}
          <input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importModel(f); }} />
        </label>
        {!p.modelKey && (
          <p className="muted small">
            Para ver tu frasco tal cual: créalo a partir de una foto con un generador 3D por IA, o escanéalo con una app
            de escaneo 3D, y expórtalo en formato GLB.
          </p>
        )}
      </section>

      <section className="card">
        <h3>Compra</h3>
        <div className="grid2">
          <label className="field">
            <span>Tamaño (ml)</span>
            <input inputMode="numeric" value={p.sizeMl} onChange={(e) => set('sizeMl', e.target.value)} placeholder="100" />
          </label>
          <label className="field">
            <span>Precio (€)</span>
            <input inputMode="decimal" value={p.price} onChange={(e) => set('price', e.target.value)} placeholder="0" />
          </label>
        </div>
        <label className="field">
          <span>Enlace de Fragrantica</span>
          <input type="url" value={p.fragranticaUrl} onChange={(e) => set('fragranticaUrl', e.target.value)} placeholder="https://www.fragrantica.es/perfume/…" />
        </label>
      </section>

      <button className="btn btn--primary btn--block btn--lg" disabled={!p.name.trim()}>Guardar</button>
    </form>
  );
}
