import { ACCORDS } from './constants.js';

// ---------- Análisis de comentarios ----------
// Cada comentario puede llevar contexto y valoración explícitos; si no, se deducen del texto.

const CONDITION_WORDS = {
  calor: /(calor|verano|caluros|\bsol\b|sofoc)/,
  'frío': /(frío|frio|invierno|helad|fresquito)/,
  templado: /(primavera|otoño|otono|entretiempo|templad)/,
  lluvia: /(lluvi|llov|llueve)/,
  humedad: /(húmed|humed|bochorno)/,
};

const OCCASION_WORDS = {
  trabajo: /(trabajo|oficina|curro|reuni)/,
  cita: /(cita|pareja|romántic|romantic)/,
  noche: /(noche|fiesta|salir|discoteca|copas)/,
  evento: /(boda|evento|gala|comunión|bautizo)/,
  deporte: /(gym|gimnasio|deporte|correr|entrenar)/,
  casual: /(diario|casual|finde|paseo|día a día)/,
};

const NEG = /(empalag|pesad|agobi|cansin|dolor de cabeza|mare[oa]|no me gust|no (me )?(va|queda|pega) bien|horrible|sintétic|desaparec|no dura|chirr|demasiado|asfixi|nada bien|fatal|regular)/;
const POS = /(perfect|genial|brutal|ideal|encant|favorit|cumplid|halag|me gust|bomba|espectacular|increíble|increible|bien|top|maravill)/;

export function analyzeComment(comment) {
  const text = (comment.text || '').toLowerCase();
  const conditions = new Set(comment.conditions || []);
  const occasions = new Set(comment.occasions || []);
  if (!conditions.size) {
    for (const [k, re] of Object.entries(CONDITION_WORDS)) if (re.test(text)) conditions.add(k);
  }
  if (!occasions.size) {
    for (const [k, re] of Object.entries(OCCASION_WORDS)) if (re.test(text)) occasions.add(k);
  }
  let sentiment = comment.sentiment || 0;
  if (!sentiment) sentiment = NEG.test(text) ? -1 : POS.test(text) ? 1 : 0;
  return { conditions, occasions, sentiment };
}

// ---------- Utilidades ----------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAY = 86400000;

export function todayKey(d = new Date()) {
  return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD en hora local
}

export function daysSince(dateKey) {
  const a = new Date(dateKey + 'T12:00:00');
  const b = new Date(todayKey() + 'T12:00:00');
  return Math.round((b - a) / DAY);
}

// Pequeña variación diaria determinista para que no salga siempre lo mismo en empate
function jitter(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5 .. 0.5
}

export function warmthOf(perfume) {
  const vals = (perfume.accords || []).map((a) => ACCORDS[a]).filter((v) => v !== undefined);
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function truncate(t, n = 60) {
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

// ---------- Puntuación ----------

export function scorePerfume(p, ctx) {
  const { weather, occasion } = ctx;
  const reasons = [];
  let score = 0;
  const add = (w, text) => {
    score += w;
    if (text && Math.abs(w) >= 0.4) reasons.push({ w, text });
  };

  // 1. Clima vs. acordes
  if (weather) {
    const warmth = warmthOf(p);
    const tf = clamp((weather.effective - 18) / 8, -1.5, 1.5); // >0 calor, <0 frío
    const climate = -warmth * tf * 2;
    const main = (p.accords || []).slice(0, 2).join(' y ');
    if (main) {
      if (climate > 0.6) add(climate, `${cap(main)}: encaja con ${weather.effective}°C`);
      else if (climate < -0.6) add(climate, `${cap(main)} puede ser ${tf > 0 ? 'mucho para el calor' : 'poco para el frío'}`);
      else add(climate);
    }
    if (weather.conditions.includes('humedad') && warmth > 0.3) add(-0.8, 'Con humedad, lo denso agobia');
  }

  // 2. Estación
  if (weather && p.seasons?.length) {
    if (p.seasons.includes(weather.season)) add(0.8, `Lo marcaste para ${weather.season}`);
    else add(-0.6);
  }

  // 3. Ocasión
  if (occasion) {
    if (p.occasions?.includes(occasion)) add(1.2, `Lo usas para ${occasion}`);
    else if (p.occasions?.length) add(-0.3);
    const intensity = p.intensity || 3;
    if (occasion === 'deporte' && intensity >= 4) add(-1.5, 'Demasiado intenso para hacer deporte');
    if (occasion === 'trabajo' && intensity >= 5) add(-0.8, 'Proyecta mucho para la oficina');
    if ((occasion === 'noche' || occasion === 'evento') && intensity >= 4) add(0.5, 'Buena proyección para la noche');
  }

  // 4. Tu valoración general
  if (p.rating) add((p.rating - 3) * 0.5, p.rating >= 4.5 ? 'De tus favoritos' : null);

  // 5. Tus comentarios
  const conds = new Set(weather?.conditions || []);
  let bestComment = null;
  for (const c of p.comments || []) {
    const a = analyzeComment(c);
    if (!a.sentiment) continue;
    const condHit = [...a.conditions].some((x) => conds.has(x));
    const occHit = occasion && a.occasions.has(occasion);
    if (condHit || occHit) {
      const w = a.sentiment * (condHit && occHit ? 2 : 1.5);
      score += w;
      if (!bestComment || Math.abs(w) > Math.abs(bestComment.w)) bestComment = { w, text: `Dijiste: “${truncate(c.text)}”` };
    } else if (!a.conditions.size && !a.occasions.size) {
      score += a.sentiment * 0.3; // comentario general
    }
  }
  if (bestComment) reasons.push(bestComment);

  // 6. Cómo te fue en días parecidos
  let fbTotal = 0;
  for (const wear of p.wears || []) {
    if (!wear.feedback) continue;
    const similarTemp = weather && wear.temp != null && Math.abs(wear.temp - weather.effective) <= 5;
    if (similarTemp) fbTotal += wear.feedback * 0.8;
    if (occasion && wear.occasion === occasion) fbTotal += wear.feedback * 0.5;
  }
  fbTotal = clamp(fbTotal, -3, 3);
  if (fbTotal >= 0.8) add(fbTotal, 'Te fue bien en días parecidos');
  else if (fbTotal <= -0.8) add(fbTotal, 'No te convenció en días parecidos');
  else add(fbTotal);

  // 7. Rotación
  const last = (p.wears || []).map((w) => w.date).sort().at(-1);
  if (!last) add(0.4, 'Aún no lo has estrenado aquí');
  else {
    const d = daysSince(last);
    if (d === 0) add(-3, 'Ya te lo pusiste hoy');
    else if (d <= 2) add(-1.2, `Te lo pusiste hace ${d} día${d > 1 ? 's' : ''}`);
    else if (d >= 21) add(0.6, `Hace ${d} días que no lo usas`);
  }

  score += jitter(todayKey() + p.id) * 0.6;

  reasons.sort((a, b) => b.w - a.w);
  const pros = reasons.filter((r) => r.w > 0).slice(0, 3);
  const cons = reasons.filter((r) => r.w < 0).slice(0, 1);
  return { perfume: p, score, reasons: [...pros, ...cons] };
}

export function recommend(perfumes, ctx) {
  return perfumes
    .filter((p) => p.status === 'tengo')
    .map((p) => scorePerfume(p, ctx))
    .sort((a, b) => b.score - a.score);
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
