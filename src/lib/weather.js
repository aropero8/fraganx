import { Geolocation } from '@capacitor/geolocation';

// Open-Meteo: gratis y sin API key
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';

export async function getCurrentCoords() {
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Mi ubicación' };
}

export async function searchCity(query) {
  const url = `${GEOCODE}?name=${encodeURIComponent(query)}&count=5&language=es&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo buscar la ciudad');
  const data = await res.json();
  return (data.results || []).map((r) => ({
    lat: r.latitude,
    lon: r.longitude,
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export function describeCode(code) {
  if (code === 0) return 'Despejado';
  if (code <= 2) return 'Poco nuboso';
  if (code === 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Niebla';
  if (code >= 51 && code <= 57) return 'Llovizna';
  if (code >= 61 && code <= 67) return 'Lluvia';
  if (code >= 71 && code <= 77) return 'Nieve';
  if (code >= 80 && code <= 82) return 'Chubascos';
  if (code >= 95) return 'Tormenta';
  return 'Variable';
}

export function seasonFor(date = new Date(), lat = 40) {
  const m = date.getMonth(); // 0-11
  let s = m <= 1 || m === 11 ? 'invierno' : m <= 4 ? 'primavera' : m <= 7 ? 'verano' : 'otoño';
  if (lat < 0) {
    s = { invierno: 'verano', verano: 'invierno', primavera: 'otoño', 'otoño': 'primavera' }[s];
  }
  return s;
}

export async function fetchWeather({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '1',
  });
  const res = await fetch(`${FORECAST}?${params}`);
  if (!res.ok) throw new Error('No se pudo obtener el tiempo');
  const d = await res.json();
  const c = d.current;
  const max = d.daily.temperature_2m_max[0];
  const min = d.daily.temperature_2m_min[0];
  const rainProb = d.daily.precipitation_probability_max?.[0] ?? 0;

  // Temperatura "efectiva" del día: mezcla de la sensación actual y la máxima,
  // porque el perfume lo llevas todo el día.
  const effective = Math.round((c.apparent_temperature + max) / 2);

  const conditions = [];
  if (effective >= 24) conditions.push('calor');
  else if (effective <= 13) conditions.push('frío');
  else conditions.push('templado');
  if (RAIN_CODES.has(c.weather_code) || c.precipitation > 0.2 || rainProb >= 60) conditions.push('lluvia');
  if (c.relative_humidity_2m >= 75 && effective >= 20) conditions.push('humedad');

  return {
    temp: Math.round(c.temperature_2m),
    apparent: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    code: c.weather_code,
    label: describeCode(c.weather_code),
    max: Math.round(max),
    min: Math.round(min),
    rainProb,
    effective,
    conditions,
    season: seasonFor(new Date(), lat),
    fetchedAt: Date.now(),
  };
}
