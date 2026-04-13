# PozApp

PWA personal para gestión doméstica: menú semanal, lista de compra multi-supermercado, pelis pendientes, tareas y fichas cifradas.

## Stack

- Frontend: HTML + CSS + JS vanilla (sin frameworks), instalable como PWA.
- Backend: PHP nativo sobre Plesk/Apache.
- Persistencia: ficheros JSON en el servidor.
- Datos sensibles cifrados en cliente con AES-256-GCM (PIN de 6 dígitos).

## Despliegue

1. Copiar todos los ficheros a un servidor con PHP y `.htaccess` habilitado.
2. Crear `config.php` a partir de `config.example.php`:
   ```bash
   cp config.example.php config.php
   ```
3. Generar el hash del token y pegarlo en `config.php`:
   ```bash
   php -r "echo password_hash('tu-token-aqui', PASSWORD_BCRYPT);"
   ```
4. Añadir el token (en claro) la primera vez que abras la app en el navegador — se guarda en `localStorage`.

## Seguridad

- `.htaccess` bloquea acceso directo a `data-*.json`, `semanas/` y `config.php`.
- Los JSON con datos personales no se versionan (ver `.gitignore`).
- La sección "Datos" cifra cada ficha en el navegador antes de enviarla al servidor.
