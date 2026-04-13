<?php
// Copiar este fichero a config.php y rellenar con el hash bcrypt del token.
// Generar hash con:
//   php -r "echo password_hash('tu-token-aqui', PASSWORD_BCRYPT);"
define('TOKEN_HASH', '$2y$10$REEMPLAZAR_CON_HASH_REAL');
