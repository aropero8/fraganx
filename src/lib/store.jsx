import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { todayKey } from './recommend.js';

// Preferences guarda en SharedPreferences en Android y en localStorage en web.
// La clave conserva el nombre antiguo del proyecto para no perder los datos guardados.
const KEY = 'perfumario:v1';
const StoreCtx = createContext(null);

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newPerfume(partial = {}) {
  return {
    id: uid(),
    name: '',
    brand: '',
    status: 'tengo',
    accords: [],
    notes: { top: '', heart: '', base: '' },
    seasons: [],
    occasions: [],
    intensity: 3,
    longevity: 3,
    rating: 0,
    image: '',
    backImage: '',
    shape: 'plano',
    fragranticaUrl: '',
    sizeMl: '',
    price: '',
    leftReason: '',
    comments: [],
    wears: [],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function StoreProvider({ children }) {
  const [state, setState] = useState({ perfumes: [], location: null });
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    Preferences.get({ key: KEY }).then(({ value }) => {
      if (value) {
        try { setState((s) => ({ ...s, ...JSON.parse(value) })); } catch { /* datos corruptos: empezamos de cero */ }
      }
      loaded.current = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) Preferences.set({ key: KEY, value: JSON.stringify(state) });
  }, [state]);

  const api = useMemo(() => {
    const updatePerfume = (id, fn) =>
      setState((s) => ({ ...s, perfumes: s.perfumes.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)) }));

    return {
      ...state,
      ready,
      savePerfume(p) {
        setState((s) => {
          const exists = s.perfumes.some((x) => x.id === p.id);
          return { ...s, perfumes: exists ? s.perfumes.map((x) => (x.id === p.id ? p : x)) : [p, ...s.perfumes] };
        });
      },
      deletePerfume(id) {
        setState((s) => ({ ...s, perfumes: s.perfumes.filter((p) => p.id !== id) }));
      },
      setStatus(id, status) {
        updatePerfume(id, () => ({ status }));
      },
      addComment(id, comment) {
        updatePerfume(id, (p) => ({
          comments: [{ id: uid(), date: new Date().toISOString(), ...comment }, ...p.comments],
        }));
      },
      deleteComment(id, commentId) {
        updatePerfume(id, (p) => ({ comments: p.comments.filter((c) => c.id !== commentId) }));
      },
      // Devuelve el id del uso para poder deshacerlo
      logWear(id, { weather, occasion }) {
        const wear = {
          id: uid(),
          date: todayKey(),
          temp: weather?.effective ?? null,
          conditions: weather?.conditions ?? [],
          occasion: occasion || null,
          feedback: 0,
        };
        updatePerfume(id, (p) => ({ wears: [...p.wears.filter((w) => w.date !== todayKey()), wear] }));
        return wear.id;
      },
      restoreComment(id, comment) {
        updatePerfume(id, (p) => ({
          comments: [...p.comments, comment].sort((a, b) => b.date.localeCompare(a.date)),
        }));
      },
      rateWear(id, wearId, feedback) {
        updatePerfume(id, (p) => ({ wears: p.wears.map((w) => (w.id === wearId ? { ...w, feedback } : w)) }));
      },
      undoWear(id, wearId) {
        updatePerfume(id, (p) => ({ wears: p.wears.filter((w) => w.id !== wearId) }));
      },
      setLocation(location) {
        setState((s) => ({ ...s, location }));
      },
      replaceAll(data) {
        setState({ perfumes: data.perfumes || [], location: data.location ?? null });
      },
      mergePerfumes(list) {
        setState((s) => ({ ...s, perfumes: [...list.map((p) => newPerfume(p)), ...s.perfumes] }));
      },
    };
  }, [state, ready]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
