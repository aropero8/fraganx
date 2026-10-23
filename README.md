# FraganX

Tu colección de perfumes con recomendaciones según el tiempo del día, la ocasión y tus propios comentarios.
React + Vite, empaquetable como app Android con Capacitor y como web instalable en iPhone.

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

## Usarla en iPhone (web instalable)

Cada cambio en `main` se publica solo en **https://aropero8.github.io/fraganx/**
(`.github/workflows/pages.yml`; en GitHub, Settings → Pages → Source: GitHub Actions).

En el iPhone: abre ese enlace en **Safari** → botón **Compartir** → **Añadir a pantalla de inicio**.
Queda con su icono, a pantalla completa y se abre sin conexión (el tiempo sí la necesita).

- Los datos se guardan solo en ese iPhone. Para pasarlos a otro móvil: **Ajustes → Copia de seguridad**.
- La web no puede descargar la ficha de Fragrantica con el enlace (Fragrantica lo bloquea desde
  otras webs): se completa pegando el texto de la página, como indica la propia ficha.
- Las versiones nuevas se instalan solas: la app se recarga la próxima vez que la dejes en segundo plano.

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

## Modelo 3D del frasco

En cada ficha con foto aparece **🧊 Ver en 3D**: un frasco que puedes girar y acercar con el dedo.
Se genera en el propio móvil, sin internet ni servicios externos (`src/lib/bottle3d.js`):

1. Separa el frasco del fondo de cada foto y mide su silueta: la **de frente** da el ancho a cada altura y la
   **de lado** (opcional, en Editar), el grosor. Sin foto de lado, el grosor se elige a ojo: plano, medio o grueso.
2. Detecta dónde acaba el tapón (el cuello, o donde el frasco se ensancha) y recorre la silueta con la sección
   que elijas para el **cuerpo** y para el **tapón**: redonda o rectangular.
3. Pega cada foto en su lado: la de frente delante, la de lado en los costados (las costuras caen en las esquinas)
   y la **de detrás** (opcional) en la espalda; sin ella, se ve la delantera en espejo.

Para que salga bien: frasco **entero**, a la **misma distancia** en todas las fotos y fondo **liso** que contraste
(una pared o un folio). La de lado, mejor desde la derecha del frasco (con el frente a la izquierda de la foto).
Los frascos con formas muy irregulares (esculturas, tapones laterales) se aproximan, no se reconstruyen.
Los perfumes sin foto tienen un frasco genérico con los colores de sus acordes y una etiqueta con su nombre.

### Tu frasco real: modelos .glb

No existe un catálogo de modelos 3D de perfumes que se pueda descargar, pero puedes importar el tuyo
(Editar → **Importar modelo 3D (.glb)**) y se usará en la estantería y el visor en lugar del frasco hecho con fotos:

- **Desde una foto, con IA**: los generadores de 3D a partir de una imagen (Meshy, Tripo, etc.) funcionan bien con
  frascos; usa una foto de frente sobre fondo blanco (las de Fragrantica o de tiendas valen) y descarga en GLB.
- **Escaneándolo** con una app de escaneo 3D del móvil (Polycam, KIRI Engine, Scaniverse…). El cristal transparente
  cuesta escanearlo: mejor con buena luz y sin reflejos.

Admite GLB con compresión Draco o meshopt (`src/lib/model3d.js`; el decodificador de Draco está en `public/draco`).
Los modelos se guardan en IndexedDB (`src/lib/modelStore.js`), no en la copia de seguridad: al restaurarla en otro
móvil hay que volver a importarlos. Los que ya no usa ningún perfume se borran al arrancar la app.

## Estantería

En **Colección** la vista por defecto es una estantería 3D de madera (`src/components/Shelf3D.jsx`): una por cada
pestaña (los tengo, los quiero, los tuve), con una balda por cada fila de frascos. Respeta la búsqueda, el orden y el
filtro de acordes. Toca un frasco para abrirlo en el visor 3D; desde ahí, **Ficha** lleva a su ficha.
Con el botón de arriba a la derecha cambias a cuadrícula o lista.

**Personalizar estantería** (debajo del mueble) elige, para cada pestaña, el material (nogal, roble, ébano, lacado
blanco, mármol, metal o vitrina de cristal), el color del fondo y la luz (cálida, neutra, fría, rosa o apagada).
Los cambios se ven al momento y se guardan con el resto de datos (`src/lib/shelfStyles.js`).

## Datos

- Se guardan en el dispositivo con `@capacitor/preferences` (localStorage en web).
- El identificador de la app (`com.alberto.perfumario`) y la clave de guardado (`perfumario:v1`) conservan el nombre
  antiguo del proyecto a propósito: cambiarlos haría que Android la tratara como otra app y se perderían los datos.
- **Ajustes → Exportar copia** copia un JSON al portapapeles (y lo descarga en web). Pegarlo en Importar lo restaura.
- **Importar desde lista**: una línea por perfume, `nombre;marca;estado;acordes;valoración`.

### Sobre Fragrantica

Fragrantica no tiene API pública y sus condiciones no permiten el acceso automático. Aun así, por comodidad,
la app descarga la página de **tus** perfumes con el enlace que les diste, de una en una y con pausas, como lo
haría el navegador (`src/lib/fragranticaPage.js`). Puede dejar de funcionar si Fragrantica cambia su web o
bloquea las peticiones; entonces queda pegar el texto. Entiende la web en español (.es) y en inglés (.com).

- **Qué se descarga**: nombre, marca, acordes (con su intensidad real) y pirámide de notas.
  Las votaciones (estaciones, día/noche, longevidad y estela) no vienen en la página: Fragrantica las carga aparte.
- **Al abrir un perfume** con enlace pero sin acordes o notas, se completa solo. En su ficha está
  **Actualizar desde Fragrantica** para volver a descargarla.
- **Muchos a la vez**: en **Ajustes → Importar** pega enlaces de Fragrantica, uno por línea
  (`enlace;quiero` o `enlace;tuve` si no lo tienes). Se crean y se completan solos; si alguno queda pendiente,
  **Ajustes → Completar desde Fragrantica** lo reintenta. Los que ya tienes (mismo enlace o mismo nombre y marca) no se repiten.
- **Tu armario entero**: Fragrantica no lo exporta y la lista llega cifrada, así que se lee de la página de tu
  perfil (`fragrantica.es/@usuario`): pestaña Armario, secciones Tengo, Quiero, Tuve y Para probar (este entra
  como quiero). El script está en `src/lib/fragranticaWardrobe.js`; baja por cada sección porque Fragrantica
  pinta los perfumes por tandas (48 en móvil, 96 en ordenador).
  - En Android, **Ajustes → Traer tu armario de Fragrantica** pide tu usuario, abre el perfil en una ventana de
    la app (`FragranticaWardrobePlugin.java`), importa los perfumes con su nombre y marca bien escritos y
    descarga sus fichas.
  - En el navegador (iPhone) copia un marcador que, abierto en tu perfil, deja los enlaces listos para Importar.
- **Votaciones y perfumes sin enlace**: pega el texto de la página (`src/lib/fragrantica.js`): abre la ficha
  en Fragrantica, baja hasta el final (para que cargue la longevidad y la estela), selecciona todo, copia y
  pégalo en **Rellenar desde Fragrantica** (Nuevo/Editar) o **Añadir longevidad y estela** (en la ficha).
  Saca además estaciones (las votadas al menos al 60 % de la más votada), ocasiones y día/noche.
  Al completar uno ya guardado no se tocan tu nombre, estaciones, ocasiones ni día/noche si ya los tenías.

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
    bottle3d.js           frasco 3D a partir de las fotos (o genérico)
    model3d.js            carga de modelos .glb importados
    modelStore.js         modelos importados en IndexedDB
    shelfStyles.js        materiales, fondos y luces de la estantería
    fragrantica.js        lectura del texto copiado de Fragrantica
    fragranticaPage.js    descarga y lectura de la página de un perfume en Fragrantica
  components/
    Today.jsx             tiempo + recomendaciones + valorar ayer
    Collection.jsx        tengo / quiero / tuve (estantería, cuadrícula o lista)
    Shelf3D.jsx           estantería 3D
    ShelfCustomizer.jsx   material, fondo y luz de la estantería
    Bottle3D.jsx          visor 3D de un frasco
    PerfumeDetail.jsx     ficha, comentarios, historial de uso
    PerfumeForm.jsx       alta y edición
    Settings.jsx          importar, exportar, ejemplos
```

## Ideas para seguir

- Notificación por la mañana con la recomendación (`@capacitor/local-notifications`).
- Botón atrás de Android con `@capacitor/app` en lugar del `popstate` actual.
- Estadísticas: más usados, coste por uso, acordes que más te gustan.
- Sincronización entre dispositivos (Supabase o Firebase).

## Licencia

Copyright (C) 2026 Alberto Ropero

Este proyecto es software libre bajo la [GNU GPL v3.0 o posterior](LICENSE).
Puedes usarlo, estudiarlo, modificarlo y redistribuirlo, pero cualquier versión
modificada que distribuyas (incluida una app publicada) tiene que publicar su
código fuente bajo esta misma licencia y conservar el aviso de autoría.
