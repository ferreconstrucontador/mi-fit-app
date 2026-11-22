# 💪 MiFitApp

Aplicación web progresiva (PWA, pensada primero para móvil) de entrenamiento personalizado. Arma rutinas con **tu** equipo, un entrenador animado en SVG te muestra cada ejercicio, y tienes cronómetro dual, voz guía en español, ajuste de cargas según cómo te sentiste (RPE) y seguimiento de tu progreso.
Todo funciona **100% sin internet** y los datos se quedan en tu teléfono.

## 📁 Estructura

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Estructura semántica: 5 pestañas, reproductor, modal y tour |
| `css/styles.css` | Temas Claro / Oscuro / Automático y diseño responsivo pensado para móvil |
| `js/app.js` | Navegación nativa (History API), almacenamiento, perfil, gimnasio, rutina, Gemini, cronómetro, voz, Wake Lock, RPE, progreso, respaldo, tour |
| `js/ejercicios.js` | Catálogo de equipo, 136 ejercicios con sus músculos y guía de postura, filtros por equipo, nivel y lesiones, y el generador de rutinas |
| `js/avatar.js` | Motor del avatar SVG (cinemática 2D): 81 animaciones, accesorios, **14 personajes** sobre el mismo esqueleto, músculos iluminados, poses A/B, marcadores guía y piso de estudio |
| `manifest.json` · `sw.js` | Instalación como app nativa y uso sin conexión |
| `icons/` | Íconos SVG y PNG (192, 512 y maskable) |

## 🚀 Despliegue en GitHub Pages

1. Sube el contenido a la rama `main` del repositorio (los archivos deben quedar en la raíz).
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, y elige `main` y la carpeta `/ (root)`.
3. Espera 1–2 minutos y abre `https://<tu-usuario>.github.io/mi-fit-app/`.
4. En el celular:
   - **Android (Chrome):** menú ⋮ → *Instalar app*.
   - **iPhone (Safari):** botón Compartir → *Agregar a inicio*.

> Todas las rutas son relativas (`./`), así que funciona en cualquier subcarpeta. El archivo `.nojekyll` evita que GitHub procese los archivos.
> Para probar en tu computadora: `python3 -m http.server 8000` y abre `http://localhost:8000` (el Service Worker no funciona si abres el archivo directamente con `file://`).

## 🎭 Entrenadores (14 personajes)

Se eligen en **Perfil → Mi entrenador** o con el botón **🎭 Entrenador** de Mi Rutina y de Entrenar. Hay 6 colores de acento (naranja, azul, verde neón, morado, rosa coral y negro/gris) que cambian ropa, cintas y luces. La elección se guarda en `localStorage` (`personaje` y `acento` dentro de `mifit_settings`) y va en el respaldo `.json` (campo `entrenador`).

- **Humanos:** Atleta Masculino, Atleta Femenina, Fuerza / Robusto, Zen / Estilizado, Ninja / Agilidad, Retro 80s.
- **Mascotas:** Gorila Fuerza, Zorrito Atleta, Jaguar Maya, Panda Fitness.
- **Objetos:** Fit-Bot (androide con juntas luminosas) y Maniquí Articulado.
- **Anatómicos:** Anatómico Hombre y Anatómico Mujer, con estética de ilustración anatómica 2.5D: siluetas esculpidas con curvas `<path>` (cada músculo es un "listón" de dos bordes suavizado con Bézier), degradados radiales plata/titanio para el volumen, fibras musculares sutiles y complexión diferenciada (hombros y pecho amplios en él; cintura marcada, cadera y glúteo más amplios en ella). Durante cada ejercicio iluminan en **carmesí intenso con resplandor pulsante** (`feGaussianBlur`) los músculos principales y en **rojo suave** los secundarios (pecho, espalda/dorsales, hombros, bíceps, tríceps, abdomen, glúteos, cuádriceps, isquiotibiales y pantorrillas). Los músculos de cada ejercicio están en `MUS_ID` y `MUS_PATRON` (`js/ejercicios.js`), con el formato `'principales|secundarios'` y códigos de 2 letras (`pe es ho bi tr ab gl cu is pa`): un ejercicio sin entrada propia hereda los de su patrón de movimiento.
  - **Código aislado:** todo el dibujo anatómico vive en el bloque `ANATOMÍA 2.5D` de `js/avatar.js` (`drawAnatomy`, tablas `AN`/`ANF`); los otros 12 modelos usan otra ruta de dibujo y no se ven afectados. Los `<defs>` (degradados y filtro) solo se inyectan cuando el personaje es anatómico.
  - **Acabado (v1.4.1):** cabeza y cuello esculpidos (arco supraciliar, pómulos, mandíbula y esternocleidomastoideos; en la mujer la coleta nace de una cofia unida al cráneo), uniones de rodillas, codos, hombros y caderas con un contorno continuo y tendones perla/titanio claro (sin "bolitas"), penumbra de oclusión entre planos y luz de borde plateada en hombros, espalda, glúteos y cuádriceps.
  - **Rendimiento:** los anatómicos se redibujan a ~30 fps y, si el teléfono va lento, pasan solos a un modo ligero (sin desenfoque ni fibras).

## 🧍 Preparación de 10 segundos y guía de postura

Antes de **cada** ejercicio hay una preparación de 10 s exactos (`PREP_SECS`): el avatar **ejecuta en bucle el movimiento real del ejercicio** (con los músculos iluminados y puntos luminosos en las articulaciones a cuidar), más una tarjeta con *Posición inicial*, *Ejecución* y *Error común a evitar*. La voz lee la posición inicial. Controles: **⏭️ Empezar ya** (salta la cuenta), **A / B** (congelan la pose inicial / el punto máximo con flechas de movimiento; tocar el mismo botón otra vez vuelve al movimiento; en B la cuenta se pausa) y **🧍 Postura inicial** (consulta en cualquier momento; pausa mientras se revisa).

- **Textos:** `GUIA_PATRON` (por patrón de movimiento) y `GUIA_ID` (por ejercicio) en `js/ejercicios.js`. La *Ejecución* es el `tip` de cada ejercicio. Mantén la posición inicial en ~14 palabras para que la voz termine antes de la cuenta de 3 s.
- **Marcadores:** `['pt'|'spine'|'span', articulación, etiqueta]`; las articulaciones son `K` rodillas, `A` pies, `W` manos, `E` codos, `S` hombros y `H` cadera. Las poses A y B salen de los fotogramas de la animación y las flechas se calculan solas.

## 🎯 Vista Enfoque / Estudio

El botón 🎯 del entrenamiento alterna entre la vista clásica y la Vista Enfoque: fondo de estudio oscuro con piso cálido, **`03 x 12`** (series × repeticiones) o el tiempo restante en tipografía gigante, cronómetro discreto debajo y el avatar a gran tamaño. La elección se guarda (`enfoque` en `mifit_settings`).

## 🔄 Actualizar la app (versionado)

Cada vez que cambies cualquier archivo:

1. Sube la versión en **`sw.js`** → `const VERSION = '1.0.1';`
2. Pon el mismo número en **`js/app.js`** → `const APP_VERSION = '1.0.1';`
3. Si agregaste archivos nuevos, añádelos a la lista `ASSETS` de `sw.js`.
4. Haz commit y push. Los teléfonos descargarán la nueva caché y verán el aviso **"🚀 Nueva versión disponible → Actualizar"**. **Hay que tocar *Actualizar*** (o cerrar la app por completo y abrirla de nuevo); mientras no se haga, el teléfono sigue con la versión anterior. El número de versión aparece al final de la pestaña Perfil para comprobarlo.

Si no cambias `VERSION`, los usuarios se quedarán con la versión anterior en caché. El Service Worker descarga los archivos con `cache: 'reload'` al instalarse: así la versión nueva nunca se precachea con archivos viejos de la caché HTTP de GitHub Pages (`max-age=600`).

## 🛠️ Mantenimiento

- **Agregar un ejercicio:** añade un objeto al arreglo `X` de `js/ejercicios.js`. Arriba del archivo está la explicación de cada campo (`p` patrón, `eq` equipo requerido, `ci` contraindicaciones, `a` animación, `f` fases). **No cambies el `id` de ejercicios que ya existen**, porque se usan en el historial y en la progresión.
- **Agregar una animación:** define poses clave en `ANIMS` de `js/avatar.js`. Los ángulos están en grados (0 = abajo, 90 = adelante, 180 = arriba); la convención completa está documentada al inicio del archivo.
- **Agregar equipo:** añádelo a `EQUIPO` en `js/ejercicios.js` y, si quieres que se dibuje, a `EQUIPO_PROP` en `js/avatar.js`.
- **Ajustar series, repeticiones y descansos por objetivo:** objeto `PARAMS` en `js/ejercicios.js`.
- **Pestaña principal del botón "Atrás":** constante `HOME_TAB` en `js/app.js` (por defecto `rutina`).

## 💾 Datos y privacidad

- `localStorage`: perfil, equipo, ajustes (incluida la API Key de Gemini, que es opcional), pestaña activa, tema, rutina del día, progresión RPE y modo viaje.
- `IndexedDB` (`MiFitDB`): `workouts` (historial), `metrics` (peso y medidas) y `mirror` (copias espejo automáticas de los últimos 7 días).
- Respaldo: archivo `mifitapp-respaldo-YYYY-MM-DD.json`, que se descarga o se comparte por WhatsApp o Drive con la Web Share API. **La API Key nunca se incluye en el respaldo.** Si hubo actividad sin respaldar, la app te lo recuerda cada 24 horas.
- Gemini (`gemini-2.5-flash`) solo se usa si tú pegas tu clave. La IA elige ejercicios **únicamente del catálogo interno** (para que el avatar pueda animarlos) y, si falla, la app vuelve al generador sin conexión.

## ⚠️ Aviso

MiFitApp no sustituye a un médico ni a un fisioterapeuta. Si tienes dolor agudo o una lesión, consulta a un profesional.

## 🔍 Catálogo de Ejercicios (visor)

En **Perfil** (y en **Progreso → Manual**) está el botón **🔍 Catálogo de Ejercicios (136)**. Abre una vista de pantalla completa para inspeccionar cualquier ejercicio sin esperar a que salga en una rutina:

- **Búsqueda** por nombre (sin distinguir mayúsculas ni acentos) y filtros por **músculo** (principal o secundario) y por **equipo** (incluye "solo peso corporal").
- **Avatar del visor** a elección (por defecto un anatómico, para ver los músculos iluminados; los demás entrenadores también funcionan y avisan que los músculos solo se iluminan en los anatómicos). La elección es temporal: **no cambia tu entrenador guardado**.
- **Visor animado** con **▶ Movimiento** continuo, **A · Pose inicial** y **B · Punto máximo** (tocar A/B otra vez vuelve al movimiento), **📍 Guía** (marcadores en las articulaciones) y flechas ◀ ▶ para recorrer la lista.
- **Etiquetas** de músculos 🔴 principales y 🩷 secundarios (los de `MUS_ID` / `MUS_PATRON` en `js/ejercicios.js`) y la tarjeta de técnica (posición inicial, ejecución y error común).

Es una vista de **solo consulta**: no escribe nada en `localStorage` ni en IndexedDB. El botón Atrás del teléfono (o Escape) la cierra.
