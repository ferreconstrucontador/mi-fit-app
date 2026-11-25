# GAP.md · Reglas de desarrollo de MiFitApp

> Nota: este archivo no existía en el repositorio; se creó en la v1.6.0 recogiendo las reglas indicadas para esa versión.
> Si hay más reglas del proyecto, agrégalas aquí.

## 1. Cero diálogos nativos del navegador
- **Prohibido** usar `window.alert()`, `window.confirm()` y `window.prompt()`. Esas ventanas muestran el nombre del dominio de la página («… dice») y rompen el diseño de la app.
- Usa solo componentes propios de la interfaz:
  - `mostrarDialogo({ titulo = 'MiFitApp', mensaje, textoConfirmar, textoCancelar, esAlerta, peligro })` (Promesa; se integra con el botón **Atrás**).
  - Paneles desplegables HTML/CSS (por ejemplo, la guía rápida de somatotipos o la ayuda de asimetría del Perfil) y `toast()`.
- Red de seguridad en `js/app.js`: `alert()` se redirige al diálogo propio y `confirm()` / `prompt()` quedan bloqueados (devuelven `false` / `null` y registran un error). No sustituyen el uso correcto de `mostrarDialogo()`.
- Todo botón de ayuda (`?`) abre un panel o modal propio, nunca una ventana nativa.

## 2. Privacidad en la interfaz
- Ningún texto, etiqueta, ayuda, modal, mensaje, `aria-label` ni `placeholder` visible puede contener nombres propios, correos electrónicos ni rutas internas.
- La interfaz es 100 % genérica y multiusuario.

## 3. Datos del usuario
- Las claves `mifit_*` de `localStorage` y la base IndexedDB `MiFitDB` deben quedar intactas en cada versión.
- Los campos nuevos son **opcionales y retrocompatibles**: si faltan (datos o respaldos anteriores) se usan valores por defecto y los datos guardados no se reescriben hasta que el usuario los edita.
- Los respaldos `.json` anteriores se siguen pudiendo restaurar sin cambios.

## 4. Versionado
- Una sola versión: `VERSION` en `sw.js` = `APP_VERSION` en `js/app.js`.
- Caché del Service Worker: `mifit-v<versión>` (el `activate` limpia también los cachés antiguos `mifitapp-…`).
- La versión se muestra al pie de **Perfil**.
- Cada publicación incrementa la versión, actualiza `README.md` y este archivo si cambian las reglas.

## 5. Salud y seguridad
- Los ajustes por somatotipo o asimetría en piernas son orientativos y **no sustituyen** la valoración de un médico o fisioterapeuta; la interfaz lo indica.
