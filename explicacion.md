# PozApp — Arquitectura y tecnologías

Una explicación sencilla de cómo está hecha la aplicación, pensada para entenderse sin entrar en el código línea a línea.

---

## ¿Qué es PozApp?

Una aplicación web personal/familiar que funciona como una **PWA** (Progressive Web App): se abre en el navegador, pero también se puede "instalar" en el móvil como si fuera una app nativa. Reúne en un solo sitio cinco utilidades del día a día:

1. **Menú semanal** — qué se come y se cena cada día.
2. **Lista de la compra** — multi-supermercado (general, Alimerka, Mercadona, Lidl).
3. **Pelis y series** — pendientes con plataforma y nota.
4. **Tareas** — con fecha y nivel de urgencia.
5. **Datos personales** — fichas con DNI, Astursalud, etc., **cifradas** con PIN.

---

## Filosofía de diseño

- **KISS (Keep It Simple, Stupid).** Cero frameworks, cero bundlers, cero dependencias npm. HTML + CSS + JavaScript "vainilla" servidos por un PHP minúsculo.
- **Sin base de datos.** Los datos viven en archivos JSON en el servidor. Más simple, más portable, más fácil de hacer copia de seguridad (basta con descargar los `.json`).
- **Privacidad por capas.** El acceso global se protege con un token compartido; los datos personales se cifran además **en el navegador** antes de subirlos, así el servidor nunca los ve en claro.
- **Cero servicios externos.** Nada de Firebase, Supabase, Google Analytics ni similares. Todo el código y los datos están en el propio hosting.

---

## Stack técnico

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend HTML | HTML5 plano | Una sola página (`index.html`) con varias "vistas" que se muestran/ocultan con clases CSS. |
| Estilos | CSS3 puro | Sin Tailwind, sin Sass. Variables CSS para temas claro/oscuro. |
| Lógica cliente | JavaScript ES2020+ vainilla | Funciones globales, sin frameworks. ~1180 líneas en un solo archivo. |
| Cripto | Web Crypto API (nativa del navegador) | AES-GCM 256 + PBKDF2-SHA256 para cifrar los datos personales con un PIN. |
| Backend | PHP 7+ (~100 líneas, archivo único `api.php`) | Lo mínimo para leer/escribir JSONs con autenticación por token. |
| Persistencia | Archivos JSON en disco | `data-compra.json`, `data-pelis.json`, `data-tareas.json`, `data-datos.json`, `semanas/menu-YYYY-WNN.json`. |
| Hosting | Plesk (Apache + PHP) | Cualquier hosting compartido sirve. |
| PWA | `manifest.json` + meta tags | Permite "instalar" la app en el móvil. |
| Fuentes | Google Fonts (Fira Code) | Único recurso externo. Solo CSS+fuentes, nada de JavaScript. |

---

## Estructura de archivos

```
menu/
├── index.html          ← Una sola página con todas las vistas
├── manifest.json       ← Metadatos PWA (nombre, iconos, colores)
├── .htaccess           ← Bloquea acceso directo a los JSONs de datos
├── api.php             ← Backend completo (auth + lectura/escritura JSON)
├── css/
│   └── app.css         ← Todos los estilos
├── js/
│   └── app.js          ← Toda la lógica de la app
├── img/                ← Iconos y logos de supermercados
├── audio/              ← Sonido del logo (huevo de Pascua)
├── semanas/            ← Un JSON por semana (menu-2026-W15.json, etc.)
├── data-compra.json    ← Lista de la compra
├── data-pelis.json     ← Pelis y series
├── data-tareas.json    ← Tareas
└── data-datos.json     ← Datos personales (cifrados)
```

---

## Cómo funciona por dentro

### 1. Arranque

Al abrir la web:
1. Se muestra una **splash screen** (pantalla de bienvenida) con el logo durante 1,4 s mínimo.
2. Si no hay token guardado, pide la clave de acceso (`prompt`) y la guarda en `localStorage`.
3. Carga en paralelo el menú de la semana actual, la lista de la compra, las pelis y las tareas haciendo 4 peticiones GET a `api.php`.
4. Renderiza la pantalla de inicio con 5 botones grandes y badges (insignias) que cuentan elementos pendientes.

### 2. Navegación

Una sola página HTML con varios `<div class="view">` superpuestos. Solo uno tiene la clase `active` a la vez. Al pulsar un botón:
- Se aplica una **animación** que clona el botón y lo "transforma" en la cabecera de la nueva pantalla (efecto de transición tipo nativa).
- Se actualiza la URL con `history.pushState` para que el botón **Atrás** del móvil funcione.

### 3. Datos sin base de datos

El backend (`api.php`) es deliberadamente minúsculo: ~100 líneas. Solo hace 4 cosas:

1. **Comprueba el token** del header `X-App-Token` con `password_verify` (bcrypt). Si no coincide → 401.
2. **GET** `?action=compra|menu|pelis|tareas|datos` → devuelve el JSON correspondiente.
3. **POST** del mismo recurso → guarda el JSON enviado tal cual.
4. **Limpieza automática** de menús de hace más de 1 mes.

No hay queries, no hay ORM, no hay migraciones. Cada sección tiene su propio archivo JSON.

### 4. Sincronización entre dispositivos

Cuando dos personas tienen abierta la lista de la compra (escenario típico: pareja comprando junta):

- Cada cliente hace **polling** cada 3 segundos pidiendo `data-compra.json` al servidor.
- Solo lo hace mientras la pantalla de Compra está visible **y** el navegador en primer plano (si bloqueas el móvil, se pausa).
- Compara un **hash estructural** (id + nombre + super + comprado) con la última versión que conoce. Si hay cambios → re-renderiza.
- Al volver el navegador a primer plano (`visibilitychange`), refresca al instante.

Esto consigue sincronización casi en tiempo real con la mínima carga posible y sin necesidad de WebSockets, SSE ni bases de datos en tiempo real.

### 5. Datos personales cifrados

La sección **Datos** es la única que necesita protección extra (DNI, números de tarjeta sanitaria, etc.). El esquema:

1. La primera vez que entras, eliges un **PIN de 6 dígitos**.
2. Cuando guardas una ficha, el navegador:
   - Genera un `salt` aleatorio (16 bytes) y un `IV` aleatorio (12 bytes).
   - Deriva una clave AES-256 desde tu PIN usando **PBKDF2** con SHA-256 y 100 000 iteraciones.
   - Cifra los datos con **AES-GCM 256**.
   - Sube al servidor un sobre con `{ cifrado, salt, iv }`. **El PIN nunca sale del navegador.**
3. Al volver, descarga el sobre, te pide el PIN, descifra en local y muestra los datos.
4. Al salir de la sección, las fichas y el PIN se borran de la memoria.

Ventaja: aunque alguien con acceso al servidor abriera `data-datos.json`, solo vería bytes ininteligibles.

### 6. Experiencia tipo nativa

Aunque es web, intenta sentirse como app:

- **PWA instalable** vía `manifest.json` (icono propio, splash, sin barra del navegador).
- **Animaciones** de transición entre pantallas, confeti al tachar items, "compra completada" al acabar un super.
- **Mantén pulsado** para borrar definitivamente, **toca** para tachar/destachar.
- **Modo claro/oscuro** automático según el sistema.
- **Toast** (mensajes flotantes) para feedback de acciones.

---

## Seguridad — qué protege y qué no

**Protege contra:**
- Acceso casual: cualquiera que entre a la URL necesita el token.
- Lectura del archivo de datos personales: sin el PIN no se descifra (cripto estándar AES-GCM).
- Acceso directo a los JSONs por URL: bloqueado por `.htaccess`.
- CSRF: la auth va en header custom, no en cookies → inmune al patrón clásico.
- Path traversal: el parámetro `week` se valida con regex estricta.
- Inyecciones XSS comunes: todo el contenido renderizado pasa por `escHtml`.

**No protege contra:**
- Un administrador del hosting con acceso al servidor que quisiera modificar la propia web (podría inyectar código que capture el PIN cuando lo tecleas). La cripto en cliente nunca puede defender contra el mismo servidor que sirve el código.
- Pérdida del PIN: si lo olvidas, **los datos cifrados son irrecuperables** (es lo que se quería).
- Pérdida del token: si alguien roba tu móvil con la app instalada, queda dentro hasta que cambies la clave en el servidor.

---

## ¿Qué tiene de bueno esta arquitectura?

- **Portátil:** copias la carpeta entera a otro hosting con PHP y funciona. No hay que migrar bases de datos.
- **Backup trivial:** descargas los JSONs y ya tienes todo.
- **Económica:** corre en cualquier hosting compartido de pocos euros al mes.
- **Mantenible:** ~1500 líneas en total, sin dependencias que actualizar, sin breaking changes.
- **Rápida:** sin frameworks, sin bundles de MB. Carga en menos de un segundo.
- **Privada:** ningún tercero ve tus datos. Nada de telemetría.

## ¿Y de malo?

- **Concurrencia limitada:** los archivos JSON no escalan a muchos usuarios escribiendo a la vez. Para 2-3 personas familiares funciona perfecto.
- **Sin offline real:** sin Service Worker, si pierdes conexión la app no carga.
- **Sin tests automáticos:** las pruebas son manuales.
- **Token compartido único:** todos los usuarios usan la misma clave. Para multiusuario real haría falta auth por usuario (planeada como evolución futura).

---

## Versión actual

**v1.3** — incluye sección Datos cifrada, sync multi-dispositivo en la lista de la compra, multi-supermercado, lista global de compra y animaciones de "compra completada" por super.
