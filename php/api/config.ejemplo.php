<?php
/**
 * Configuración de los scripts PHP (hosting DonWeb).
 *
 * CÓMO SE USA
 *  1. Copiá este archivo con el nombre config.php.
 *  2. Completá los valores.
 *  3. Subilo UNA sola vez al servidor, a la carpeta api/ (por FTP o con el administrador de archivos de Ferozo).
 *
 * IMPORTANTE: config.php tiene secretos y NO va al repositorio (está en .gitignore).
 * El deploy automático no lo pisa ni lo borra.
 *
 * Alternativa sin archivo: definir las mismas claves como variables de entorno del servidor,
 * en mayúsculas (GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, CONTACTO_DESTINATARIO, etc.).
 */
return [
    // --- Login del panel (/admin) con GitHub ---
    // Se obtienen al crear la "OAuth App" en GitHub (ver README, sección DonWeb).
    'github_oauth_client_id'     => '',
    'github_oauth_client_secret' => '',

    // --- Formulario de contacto ---
    // Casilla que recibe las consultas. Si queda vacío se usa el email público del sitio.
    'contacto_destinatario' => '',
    // Remitente técnico: tiene que ser una casilla del mismo dominio para que el mail no caiga en spam.
    // Si queda vacío se usa web@<dominio del sitio>.
    'contacto_remitente'    => '',

    // --- Opcional ---
    // Dirección del sitio (sin barra final). Si queda vacío se detecta sola.
    'sitio_origen' => '',
];
