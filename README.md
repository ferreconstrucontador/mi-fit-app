# 💪 MiFitApp

Aplicación web progresiva (PWA, pensada primero para móvil) de entrenamiento personalizado. Arma rutinas con **tu** equipo, un entrenador animado en SVG te muestra cada ejercicio, y tienes cronómetro dual, voz guía en español, ajuste de cargas según cómo te sentiste (RPE) y seguimiento de tu progreso.
Todo funciona **100% sin internet** y los datos se quedan en tu teléfono.

## 📁 Estructura

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Estructura semántica: 5 pestañas, reproductor, modal y tour |
| `css/styles.css` | Temas Claro / Oscuro / Automático y diseño responsivo pensado para móvil |
| `js/app.js` | Navegación nativa (History API), almacenamiento, perfil, gimnasio, rutina, Gemini, cronómetro, voz, Wake Lock, RPE, progreso, respaldo, tour |
| `js/ejercicios.js` | Catálogo de equipo, base de ~130 ejercicios, filtros por equipo, nivel y lesiones, y el generador de rutinas |
| `js/avatar.js` | Motor del avatar SVG (cinemática 2D) con más de 70 animaciones y accesorios |
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

## 🔄 Actualizar la app (versionado)

Cada vez que cambies cualquier archivo:

1. Sube la versión en **`sw.js`** → `const VERSION = '1.0.1';`
2. Pon el mismo número en **`js/app.js`** → `const APP_VERSION = '1.0.1';`
3. Si agregaste archivos nuevos, añádelos a la lista `ASSETS` de `sw.js`.
4. Haz commit y push. Los teléfonos descargarán la nueva caché y verán el aviso **"🚀 Nueva versión disponible → Actualizar"**. El cambio no se aplica a mitad de un entrenamiento.

Si no cambias `VERSION`, los usuarios se quedarán con la versión anterior en caché.

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
