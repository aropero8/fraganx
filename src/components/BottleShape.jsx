import { SECTIONS, THICKNESS, bottleShape } from '../lib/constants.js';

// Forma del frasco hecho con fotos: sección del cuerpo y del tapón y, sin foto de lado, el grosor.
// Va aparte del visor 3D para que el formulario no cargue three.js.
export default function BottleShape({ perfume, onChange, thickness = !perfume.sideImage }) {
  const shape = bottleShape(perfume);
  const set = (k, v) => onChange({ ...shape, [k]: v });
  const rows = [
    ['body', 'Cuerpo', SECTIONS],
    ['cap', 'Tapón', SECTIONS],
    ...(thickness ? [['thickness', 'Grosor', THICKNESS]] : []),
  ];
  return (
    <div className="bottle-shape">
      {rows.map(([key, label, options]) => (
        <div key={key} className="bottle-shape__row">
          <span className="small muted">{label}</span>
          <div className="segmented segmented--small">
            {Object.entries(options).map(([k, o]) => (
              <button type="button" key={k} className={shape[key] === k ? 'on' : ''} onClick={() => set(key, k)}>{o.label}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
