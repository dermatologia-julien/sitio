<?php
/**
 * Formulario de contacto (hosting DonWeb).
 *
 * Recibe el POST del formulario del sitio, valida los datos y manda un mail.
 * Responde siempre en JSON:
 *   200 {"ok":true}                  → enviado
 *   405 / 403 / 422 / 429 / 500      → {"ok":false,"error":"mensaje para mostrar"}
 *
 * A quién le llega: clave 'contacto_destinatario' de api/config.php
 * (o variable de entorno CONTACTO_DESTINATARIO). Si no está, se usa el email público del sitio.
 */

declare(strict_types=1);

require __DIR__ . '/_comun.php';

cabeceras_privadas();
header('Content-Type: application/json; charset=utf-8');

/** Corta la ejecución con un código HTTP y un mensaje en JSON. */
function responder(int $codigo, array $datos): void
{
    // Si el navegador mandó el formulario sin JavaScript, lo llevamos a una página en vez de mostrar JSON.
    $quiereHtml = strpos((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'text/html') !== false;
    if ($quiereHtml && $codigo === 200) {
        header('Location: /gracias/', true, 303);
        exit;
    }
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Limpia un campo de una sola línea: sin saltos de línea (evita inyección de cabeceras) ni espacios de más. */
function linea(string $campo, int $max): string
{
    $valor = (string) ($_POST[$campo] ?? '');
    $valor = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $valor) ?? '';
    $valor = trim(preg_replace('/\s+/u', ' ', $valor) ?? '');
    return function_exists('mb_substr') ? mb_substr($valor, 0, $max) : substr($valor, 0, $max);
}

/** Largo en caracteres (no en bytes). */
function largo(string $texto): int
{
    return function_exists('mb_strlen') ? mb_strlen($texto) : strlen($texto);
}

// --- Solo POST ---
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    responder(405, ['ok' => false, 'error' => 'Método no permitido.']);
}

// --- Solo desde el propio sitio ---
$origen = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origen !== '') {
    $hostOrigen = strtolower((string) parse_url($origen, PHP_URL_HOST));
    $hostSitio = strtolower((string) parse_url(origen_sitio(), PHP_URL_HOST));
    $sinWww = static fn (string $h): string => preg_replace('/^www\./', '', $h) ?? $h;
    if ($hostOrigen === '' || $sinWww($hostOrigen) !== $sinWww($hostSitio)) {
        responder(403, ['ok' => false, 'error' => 'Origen no permitido.']);
    }
}

// --- Honeypot: el campo "empresa" está oculto; si viene con algo, es un robot. Respondemos OK y no mandamos nada. ---
if (trim((string) ($_POST['empresa'] ?? '')) !== '') {
    responder(200, ['ok' => true]);
}

// --- Datos ---
$nombre   = linea('nombre', 100);
$email    = linea('email', 150);
$telefono = linea('telefono', 40);
$consulta = trim(str_replace(["\r\n", "\r"], "\n", (string) ($_POST['consulta'] ?? '')));
$consulta = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $consulta) ?? '';

$errores = [];
if (largo($nombre) < 2) {
    $errores[] = 'Escribí tu nombre y apellido.';
}
if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $errores[] = 'Revisá el email: parece incompleto.';
}
if ($telefono !== '' && !preg_match('/^[0-9+()\-\s.]{6,40}$/', $telefono)) {
    $errores[] = 'Revisá el teléfono: usá solo números.';
}
if (largo($consulta) < 5) {
    $errores[] = 'Contanos tu consulta.';
} elseif (largo($consulta) > 4000) {
    $errores[] = 'La consulta es muy larga (máximo 4.000 caracteres).';
}
if ($errores) {
    responder(422, ['ok' => false, 'error' => implode(' ', $errores)]);
}

// --- Límite simple: hasta 5 envíos cada 10 minutos por conexión ---
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
$archivoLimite = rtrim(sys_get_temp_dir(), '/\\') . '/julien-contacto-' . hash('sha256', $ip . '|' . __DIR__) . '.json';
$ahora = time();
$previos = is_file($archivoLimite) ? json_decode((string) @file_get_contents($archivoLimite), true) : [];
$previos = array_values(array_filter(is_array($previos) ? $previos : [], static fn ($t): bool => is_int($t) && $t > $ahora - 600));
if (count($previos) >= 5) {
    header('Retry-After: 600');
    responder(429, ['ok' => false, 'error' => 'Recibimos varias consultas seguidas. Probá de nuevo en unos minutos o escribinos por WhatsApp.']);
}

// --- Mail ---
$sitio = datos_sitio();
$nombreSitio = (string) ($sitio['nombre'] ?? 'Sitio web');
$destinatario = cfg('contacto_destinatario', (string) ($sitio['email'] ?? ''));
if ($destinatario === '' || filter_var($destinatario, FILTER_VALIDATE_EMAIL) === false) {
    error_log('contacto.php: falta configurar contacto_destinatario.');
    responder(500, ['ok' => false, 'error' => 'No pudimos enviar tu consulta. Escribinos por WhatsApp.']);
}
$dominio = preg_replace('/^www\./', '', (string) parse_url(origen_sitio(), PHP_URL_HOST)) ?: 'localhost';
$remitente = cfg('contacto_remitente', 'web@' . $dominio);
if (filter_var($remitente, FILTER_VALIDATE_EMAIL) === false) {
    $remitente = 'web@' . $dominio;
}

$asunto = 'Consulta desde el sitio web: ' . $nombre;
$cuerpo = "Nueva consulta desde el formulario del sitio.\n\n"
    . "Nombre: {$nombre}\n"
    . "Email: {$email}\n"
    . 'Teléfono: ' . ($telefono !== '' ? $telefono : '(no lo dejó)') . "\n\n"
    . "Consulta:\n{$consulta}\n\n"
    . "---\nPara contestar, respondé este mail: la respuesta le llega directo a la persona.\n";

$codificar = static fn (string $t): string => '=?UTF-8?B?' . base64_encode($t) . '?=';
$cabeceras = [
    'From: ' . $codificar($nombreSitio) . ' <' . $remitente . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: PHP/' . PHP_VERSION,
];

// El parámetro -f fija el remitente real del envío (mejora la entrega). Solo se usa si la casilla es "simple".
$extra = preg_match('/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/', $remitente) ? '-f' . $remitente : '';
$enviado = @mail($destinatario, $codificar($asunto), $cuerpo, implode("\r\n", $cabeceras), $extra);
if (!$enviado) {
    error_log('contacto.php: mail() devolvió false.');
    responder(500, ['ok' => false, 'error' => 'No pudimos enviar tu consulta. Probá de nuevo o escribinos por WhatsApp.']);
}

$previos[] = $ahora;
@file_put_contents($archivoLimite, json_encode($previos), LOCK_EX);

responder(200, ['ok' => true]);
