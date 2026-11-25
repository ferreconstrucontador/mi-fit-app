# 💪 MiFitApp

Aplicación web progresiva (PWA, pensada primero para móvil) de entrenamiento personalizado. Arma rutinas con **tu** equipo, un entrenador animado en SVG te muestra cada ejercicio, y tienes cronómetro dual, voz guía en español, ajuste de cargas según cómo te sentiste (RPE) y seguimiento de tu progreso.
Todo funciona **100% sin internet** y los datos se quedan en tu teléfono.

## 📁 Estructura

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Estructura semántica: 5 pestañas, reproductor, modal y tour |
| `css/styles.css` | Temas Claro / Oscuro / Automático y diseño responsivo pensado para móvil |
| `js/app.js` | Navegación nativa (History API), almacenamiento, perfil, gimnasio, rutina, Gemini, cronómetro, voz, Wake Lock, RPE, progreso, respaldo, tour |
| `js/ejercicios.js` | Catálogo de equipo, 140 ejercicios con sus músculos y guía de postura, filtros por equipo, nivel y lesiones, y el generador de rutinas |
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

## 🪜 Escaladora vertical / Stepper

Equipo `escaladora` ("Escaladora vertical / Stepper", categoría *Cardio* de Mi Gimnasio y del filtro *"Hoy solo tengo…"*). Trae 4 ejercicios: **ritmo constante**, **intervalos HIIT** y **paso profundo** (estos dos con contraindicación de *rodillas*) y **paso lateral**. El avatar dibuja la máquina (base estabilizadora, columna inclinada con manillar y dos pedales que siguen exactamente a los pies) en perfil y de frente, con las animaciones `stepper`, `stepperhiit`, `stepperdeep` y `steppersid` (Pose A / Pose B / movimiento fluido) para los 14 entrenadores.

## 🛠️ Especificaciones del equipo y herramientas extra (Mi Gimnasio)

- **Detalle por equipo (etiquetas acumulables, v1.5.1):** al marcar un equipo puedes agregar varias etiquetas (por ejemplo `5-40 lbs`, `Ajustables`, `3 ángulos 35°-55°`). Cada una es una píldora con `×` para quitarla; se agregan con el botón `+`, con Enter o al salir del campo, y los chips de sugerencia **suman** una píldora nueva sin sobrescribir (sin duplicados exactos, máximo 8, aviso "✓ Guardado"). Se guarda en `mifit_equipo_specs` como `{ idEquipo: ["etiqueta", ...] }`. Un texto de la v1.5.0 (`{ idEquipo: "texto" }`) se muestra como primera etiqueta y no se reescribe hasta que lo edites. Las etiquetas se unen con comas en la insignia ⚙️ de la rutina, en el prompt de Gemini y en el respaldo `.json` (`equipoSpecsFormato: "coma"`; al restaurar se separan de nuevo).
- **➕ Agregar equipo o herramienta extra:** nombre, especificación opcional y *compatibilidad de movimiento* (Peso corporal / Tren inferior, Mancuernas / Carga libre, Ligas / Resistencia, Cardio / Stepper, Tren superior, Core, Movilidad u Otro). Se guarda en `mifit_equipo_custom` (`[{ id, n, spec, cat, on }]`), se puede activar/desactivar o eliminar, aparece como etiqueta 🛠️ en los ejercicios compatibles y el generador la favorece ligeramente. Las categorías están en `COMPAT` (`js/ejercicios.js`).
- **Generador y Gemini:** el generador offline considera la escaladora y las herramientas extra activas. El prompt de Gemini incluye el equipo con sus especificaciones y las herramientas extra, pide elegir ejercicios solo por id del catálogo y mencionar en la nota el peso, ángulo o resistencia exacta.
- **Datos:** ambas claves viajan en el respaldo `.json` (también como campos `equipoSpecs` y `equipoCustom`) y se borran con "Borrar todos mis datos". Las claves existentes no cambian.

## 🔥 Gasto calórico (v1.5.1)

`kcal = MET ajustado × peso (kg) × (segundos activos ÷ 3600)`, calculado por ejercicio con su tiempo activo real (los descansos no cuentan; si terminas antes, cuenta la serie en curso). Peso de **Perfil** (68 kg si está vacío).

| Tipo | MET |
|---|---|
| Calentamiento, enfriamiento, movilidad | 2.8 |
| Fuerza con peso corporal, ligas, accesorios ligeros | 5.0 |
| Fuerza con carga libre (mancuernas, barra, kettlebell) | 5.8 (×1.08 si anotaste etiquetas de ese equipo) |
| Escaladora ritmo constante / paso lateral | 7.5 |
| Escaladora HIIT / paso profundo | 9.5 |
| Otro cardio intenso (saltos, burpees, cuerda) | 8.5 |

Multiplicador por RPE: Fácil ×0.90 · Justo ×1.00 · Muy pesado ×1.15. El resumen muestra el total redondeado con la nota "Estimado según tu peso, tiempo activo e intensidad"; en `MiFitDB` (`workouts`) se guarda `kcal`, `kcalPeso` y `kcalDet` (desglose por ejercicio) para las gráficas de Progreso. Los entrenamientos anteriores no se modifican.

## 🫀 Pulido de los Anatómicos y posturas (v1.5.2)

- **Posturas corregidas (todos los avatares):** *Lagartija con rodillas apoyadas* (rodillas fijas en el piso, pantorrillas y pies elevados hacia atrás; manos y rodillas a la misma altura en A y B) y *Superman* (anim `superman`: boca abajo con abdomen apoyado, brazos y piernas extendidos que se elevan en arco; usa un encuadre más ancho). *Cobra suave* y *Y-T-W* conservan la animación `cobra`.
- **Anatómico Mujer:** en vistas frontales la coleta se dibuja como moño alto centrado; en perfil sigue igual.
- **Rostro y manos:** sombreado facial suave (cejas, cuencas, pómulos y mandíbula con desenfoque ligero), manos esculpidas (palma, nudillos, dedos y pulgar orientados al antebrazo) y pies con dedos y empeine.
- **Fibras y volumen:** fibras orientadas por grupo (largas, abanico en pectoral, oblicuas en deltoides/glúteos/oblicuos/dorsales) que se encienden en carmesí con un brillo `feGaussianBlur` al acercarse al Punto Máximo (B); oclusión en pliegues de rodilla y cadera, penumbra con dirección de luz y sombra de piso dinámica según el ancho y la elevación del cuerpo.
- Los otros 12 avatares no cambian (verificado con huellas SHA-256), salvo las dos posturas anteriores. Se mantiene el límite de ~30 fps y el modo ligero.

## 🧘 Posturas corregidas (v1.5.3)

- **Y-T-W boca abajo** (anim `ytw`): decúbito prono con el abdomen y las piernas en el piso, torso apenas elevado y brazos que dibujan Y, T y W en el aire.
- **Cobra suave** (`cobra`): pelvis y piernas apoyadas en el piso; solo el pecho se eleva, con los antebrazos apoyados (esfinge).
- **Jalón isométrico con toalla** (`towelpull`, de frente): se dibuja la toalla tensada entre ambas manos, de arriba hacia el pecho.
- **Estiramiento de cuádriceps de pie** (`stretchquad`): la mano del lado de la pierna flexionada sujeta el empeine/tobillo (posiciones calculadas con cinemática inversa).
- Solo cambian esas animaciones; `pulldown` (ligas/banda), los demás ejercicios y el estilo de los avatares siguen igual. Datos de usuario intactos.

## ⛶ Pantalla completa y más posturas (v1.5.4)

- **Catálogo en pantalla completa:** el botón **⛶** (esquina superior derecha del avatar) expande el visor al 100 % del celular. Muestra arriba el nombre, el grupo y los músculos principales con **✕**; abajo **◀ ▶** y los controles **▶ Movimiento · A · B · 📍 Guía**. Se navega por los ejercicios filtrados con las flechas o deslizando a izquierda/derecha. **Atrás** sale primero de la pantalla completa sin cerrar el catálogo (el segundo Atrás lo cierra).
- **Posturas corregidas:** *Postura del niño* (`child`: sentado sobre los talones, torso sobre los muslos, brazos al frente en el piso), *Pullover con mancuerna* (`pullover`: supino, la mancuerna describe un arco por encima de la cabeza sin atravesar el cuerpo), *Dead bug* (`deadbug`: base con muslos verticales y rodillas a 90° y brazos al techo; se extienden brazo y pierna contrarios), *Plancha lateral* (`sideplank`: apoyo en antebrazo y borde del pie), *Plancha con toque de hombro* (`shouldertap`: la mano cruza el pecho hacia el hombro contrario) y *Rueda abdominal* (`rollout`: la rueda rueda sobre el piso desde las rodillas).
- **Hip thrust con mancuerna** (`hipthrust`): banco bajo la espalda alta y mancuerna sobre la pelvis; el puente de glúteo en el piso (`bridge`) no cambia.
- **Etiquetas guía:** Burpee, Burpee sin salto, Gusano y Caminata de manos ahora dicen *Core firme / Manos bajo hombros / Extensión completa*.
- Solo cambian esas animaciones (verificado con huellas SHA-256 de los 12 avatares estilizados); datos de usuario intactos.

## 🧬 Somatotipo y asimetría en piernas (v1.6.0)

Dos campos opcionales en **Perfil → Tipo de cuerpo y simetría** (se guardan dentro de `mifit_profile`: `somatotipo` y `asimetria`; los perfiles y respaldos anteriores siguen funcionando igual y los datos no se reescriben hasta que los editas).

- **Somatotipo** (`No especificado` por defecto, `Ectomorfo`, `Mesomorfo`, `Endomorfo`) con botón **?** que despliega una guía rápida integrada: 3 tarjetas con rasgo óseo, metabolismo y silueta (incluye la referencia al *triángulo invertido*). Tocar una tarjeta selecciona el somatotipo.
  - **Ectomorfo:** favorece ejercicios compuestos, mitad de cardio y máx. 1 bloque (de ≤ 30 s), descansos +15 s.
  - **Mesomorfo / no especificado:** sin cambios (balance estándar).
  - **Endomorfo:** descansos −10 a −15 s y bloques de cardio de bajo impacto (también en hipertrofia y fuerza, uno cada 4 ejercicios).
  - La movilidad no se modifica.
- **Asimetría en piernas:** `Ninguna`, `Discrepancia de longitud / pierna más corta` o `Menor fuerza o movilidad en una pierna`, con lado `Izquierda` / `Derecha` (el ajuste se activa al elegir tipo y lado). Botón **?** con la explicación y el aviso de que no sustituye la valoración médica o de fisioterapia.
  - Se favorecen unilaterales estables de tren inferior (puente a una pierna, zancada estática y hacia atrás, subir al escalón, sentadilla búlgara, patada de glúteo, elevación de talones), se **excluyen** saltos e impacto asimétrico alto (sentadilla con salto, burpee, skaters, cuerda, rodillas altas, talones al glúteo, jumping jacks, escaladora HIIT) y se reducen los de impacto moderado. Afecta al generador offline, al botón «Cambiar ejercicio» y al catálogo que recibe Gemini.
  - Las tarjetas de tren inferior muestran una nota breve: empezar la serie con la pierna indicada y repetir con la otra.
- **Gemini:** el prompt incluye el somatotipo y la asimetría (con lado) y las reglas correspondientes.
- **Respaldo `.json`:** se exportan `somatotipo` y `asimetria` (además de dentro de `mifit_profile`); los respaldos de la v1.5.x se restauran sin tocar estos campos.
- **Versión:** el caché del Service Worker pasa a llamarse `mifit-v1.6.0` (el `activate` limpia también los antiguos `mifitapp-…`). Ya no existe ninguna llamada a `alert()`, `confirm()` ni `prompt()` nativos: ver `GAP.md`.

## 💬 Diálogos propios (v1.5.6)

Las ventanas nativas del navegador (`confirm()` / `alert()`, que mostraban el nombre del dominio de la página seguido de «dice») se reemplazaron por un diálogo propio con el título **MiFitApp** y los colores del tema (claro / oscuro / automático).

- **API:** `mostrarDialogo({ titulo = 'MiFitApp', mensaje, textoConfirmar = 'Aceptar', textoCancelar = 'Cancelar', esAlerta = false, peligro = false })` devuelve una Promesa (`true` = confirmó, `false` = canceló; un aviso `esAlerta` siempre resuelve `true`). Si hay varios, se muestran en cola.
- **Dónde se usa:** eliminar una herramienta extra, salir de un entrenamiento sin guardar, borrar una sesión del historial, restaurar un respaldo `.json` o una copia espejo y «Borrar todos mis datos» (dos confirmaciones). Las acciones destructivas usan el botón rojo y dejan el foco en «Cancelar».
- **Botón Atrás (History API):** el diálogo es una capa más de la pila; **Atrás**, **Esc** o tocar fuera lo cancelan sin salir de la app ni de la pantalla (por ejemplo, el entrenamiento sigue activo).
- No cambian los datos de `localStorage` ni de IndexedDB; `js/avatar.js` y `js/ejercicios.js` no se tocaron.

## 🦶 Contacto con el piso (v1.5.5)

Auditoría de las 89 animaciones en uso: se midió la altura sobre el piso de los apoyos que deben tocar (manos, rodillas, pies, pelvis; 6 px = contacto ideal) en todos los fotogramas. Se corrigieron las animaciones que flotaban:

- **Plancha alta** (base compartida, ahora 68.4°): `pushup` (Lagartija y variantes; en B el cuerpo gira sobre las puntas), `shouldertap`, `burpee`, `burpeelow`, `inchworm`; `mountain` reescrita (la rodilla viaja al pecho con el pie en el aire).
- **Plancha de antebrazos** (`plank`): cuerpo a 81°, antebrazos horizontales sobre el piso. **Pike push-up** (`pike`).
- **Cuadrupedia** (torso ~18° y codos casi rectos, pies hacia atrás sobre el piso): `catcow`, `glutekick`, `birddog`.
- **Acostado:** `floorpress`, `crunch`, `kneehug`, `legraise` (pelvis a 13 px del piso, `anchor: 'pelvis'` con `pelvisH`) y `bridge` (talones y cabeza apoyados).
- **Postura del niño** (`child`) recalculada y **Giro ruso** (`russian`): ahora sentado en el piso con pies apoyados.
- Sin cambio: Fondos en silla (`dips`, pendiente de rediseño) y diferencias menores de 4–5 px (zancadas, estiramiento lateral, burpee agachado, gusano doblado).
- Los demás animaciones (y el estilo de los 12 avatares estilizados) no cambian; se verificó con huellas SHA-256. Datos de usuario intactos.

## 🔍 Catálogo de Ejercicios (visor)

En **Perfil** (y en **Progreso → Manual**) está el botón **🔍 Catálogo de Ejercicios (140)**. Abre una vista de pantalla completa para inspeccionar cualquier ejercicio sin esperar a que salga en una rutina:

- **Búsqueda** por nombre (sin distinguir mayúsculas ni acentos) y filtros por **músculo** (principal o secundario) y por **equipo** (incluye "solo peso corporal").
- **Avatar del visor** a elección (por defecto un anatómico, para ver los músculos iluminados; los demás entrenadores también funcionan y avisan que los músculos solo se iluminan en los anatómicos). La elección es temporal: **no cambia tu entrenador guardado**.
- **Visor animado** con **▶ Movimiento** continuo, **A · Pose inicial** y **B · Punto máximo** (tocar A/B otra vez vuelve al movimiento), **📍 Guía** (marcadores en las articulaciones) y flechas ◀ ▶ para recorrer la lista.
- **Etiquetas** de músculos 🔴 principales y 🩷 secundarios (los de `MUS_ID` / `MUS_PATRON` en `js/ejercicios.js`) y la tarjeta de técnica (posición inicial, ejecución y error común).

Es una vista de **solo consulta**: no escribe nada en `localStorage` ni en IndexedDB. El botón Atrás del teléfono (o Escape) la cierra.
