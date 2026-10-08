# Perfumario

Tu colección de perfumes con recomendaciones según el tiempo del día, la ocasión y tus propios comentarios.
React + Vite, empaquetable como app Android con Capacitor.

## Arrancar en el navegador

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite. En **Ajustes → Cargar ejemplos** tienes 6 perfumes para probar.

## Pasarlo a Android

Necesitas Android Studio instalado.

```bash
npx cap add android        # solo la primera vez
npm run android:sync       # compila y copia la web a /android
npm run android:open       # abre Android Studio → Run
```

**Permiso de ubicación** (solo la primera vez, tras `cap add android`): en
`android/app/src/main/AndroidManifest.xml`, dentro de `<manifest>`, añade:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Si no das permiso, puedes buscar tu ciudad a mano en la pantalla Hoy.

## Cómo decide qué recomendarte

Todo está en `src/lib/recommend.js`. Para cada perfume que **tienes**, suma o resta puntos por:

| Factor | Qué mira |
|---|---|
| Clima | Cada acorde tiene una "calidez" (cítrico −1 … oud +1, en `constants.js`). Con calor premia lo fresco; con frío, lo denso. Con humedad penaliza lo pesado. |
| Estación | Si lo marcaste para la estación actual. |
| Ocasión | Si eliges una (trabajo, cita…), premia los que tienen esa ocasión; penaliza proyección alta para deporte u oficina. |
| Valoración | Tus estrellas. |
| **Tus comentarios** | Se interpretan: «con calor me empalaga» → negativo para *calor*. Si hoy hace calor, resta. Puedes marcar la valoración y el contexto a mano, o dejar que lo deduzca del texto. |
| Días parecidos | Cuando te pones algo, se guarda la temperatura. Al día siguiente te pregunta 👍/👎 y eso cuenta para días con temperatura similar (±5 °C). |
| Rotación | Resta si te lo pusiste hace poco, suma si llevas semanas sin usarlo. |

Cada recomendación muestra las razones, así que ves por qué te lo sugiere.

## Datos

- Se guardan en el dispositivo con `@capacitor/preferences` (localStorage en web).
- **Ajustes → Exportar copia** copia un JSON al portapapeles (y lo descarga en web). Pegarlo en Importar lo restaura.
- **Importar desde lista**: una línea por perfume, `nombre;marca;estado;acordes;valoración`.

### Sobre Fragrantica

Fragrantica no tiene API pública y sus condiciones no permiten scraping, así que no hay importación automática.
Lo más rápido: copia los nombres de tu colección de Fragrantica a la lista de importar, y en cada ficha pega
el enlace de Fragrantica (sale un botón «Ver en Fragrantica»).

## Estructura

```
src/
  App.jsx                 navegación (Hoy / Colección / Ajustes)
  lib/
    constants.js          acordes, estaciones, ocasiones
    weather.js            Open-Meteo (gratis, sin API key) + GPS
    recommend.js          motor de recomendación y lectura de comentarios
    store.jsx             estado y persistencia
    samples.js            datos de ejemplo
  components/
    Today.jsx             tiempo + recomendaciones + valorar ayer
    Collection.jsx        tengo / quiero / tuve
    PerfumeDetail.jsx     ficha, comentarios, historial de uso
    PerfumeForm.jsx       alta y edición
    Settings.jsx          importar, exportar, ejemplos
```

## Ideas para seguir

- Notificación por la mañana con la recomendación (`@capacitor/local-notifications`).
- Botón atrás de Android con `@capacitor/app` en lugar del `popstate` actual.
- Estadísticas: más usados, coste por uso, acordes que más te gustan.
- Sincronización entre dispositivos (Supabase o Firebase).
