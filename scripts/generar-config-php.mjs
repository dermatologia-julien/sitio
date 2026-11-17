// Escribe por salida estándar un api/config.php a partir de variables de entorno.
// Lo usa el flujo de GitHub Actions (deploy-donweb.yml) con los secrets del repositorio.
// Uso: OAUTH_CLIENT_ID=… OAUTH_CLIENT_SECRET=… node scripts/generar-config-php.mjs > dist/api/config.php

// Comillas simples de PHP: solo hay que escapar la barra invertida y la comilla simple.
const php = (v = '') => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const e = process.env;

process.stdout.write(`<?php
// Archivo generado por el deploy. No editar a mano: los valores salen de los secrets de GitHub.
return [
    'github_oauth_client_id'     => ${php(e.OAUTH_CLIENT_ID)},
    'github_oauth_client_secret' => ${php(e.OAUTH_CLIENT_SECRET)},
    'contacto_destinatario'      => ${php(e.CONTACTO_DESTINATARIO)},
    'contacto_remitente'         => ${php(e.CONTACTO_REMITENTE)},
    'sitio_origen'               => ${php((e.SITE_URL || '').replace(/\/+$/, ''))},
];
`);
