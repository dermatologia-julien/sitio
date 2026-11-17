<?php
/**
 * Login del panel (/admin) con GitHub, para hosting DonWeb.
 *
 * Decap CMS abre esta página en una ventanita. El recorrido es:
 *   1. Sin "code": mandamos a la persona a GitHub para que autorice.
 *   2. GitHub vuelve acá con un "code": lo cambiamos por un token (del lado del servidor, con el secreto).
 *   3. Le pasamos el token a la ventana del panel y esta ventanita se cierra sola.
 *
 * Necesita una "OAuth App" de GitHub cuya "Authorization callback URL" sea
 *   https://<dominio>/api/auth.php
 * El Client ID y el Client Secret van en api/config.php (o en variables de entorno). Nunca en el repositorio.
 */

declare(strict_types=1);

require __DIR__ . '/_comun.php';

cabeceras_privadas();

const COOKIE_ESTADO = 'julien_oauth_estado';

$clientId     = cfg('github_oauth_client_id');
$clientSecret = cfg('github_oauth_client_secret');
$origen       = origen_sitio();
$urlRetorno   = $origen . '/api/auth.php';

/** Página final: le avisa el resultado a la ventana del panel con el formato que espera Decap. */
function responder_al_panel(string $estado, array $contenido, string $origen): void
{
    $mensaje = 'authorization:github:' . $estado . ':' . json_encode($contenido, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
    $jsMensaje = json_encode($mensaje, $flags);
    $jsOrigen = json_encode($origen, $flags);
    $texto = $estado === 'success'
        ? 'Listo. Ya podés volver al panel; esta ventana se cierra sola.'
        : 'No pudimos iniciar la sesión: ' . htmlspecialchars((string) ($contenido['error'] ?? 'error desconocido'), ENT_QUOTES, 'UTF-8');
    header('Content-Type: text/html; charset=utf-8');
    echo <<<HTML
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Ingreso al panel</title></head>
<body style="font-family: sans-serif; padding: 24px;">
<p>{$texto}</p>
<script>
(function () {
  var mensaje = {$jsMensaje};
  var origenPermitido = {$jsOrigen};
  if (!window.opener) { return; }
  // El panel contesta el saludo y recién ahí le mandamos el resultado, solo si es nuestro sitio.
  window.addEventListener('message', function (e) {
    if (e.origin !== origenPermitido) { return; }
    window.opener.postMessage(mensaje, e.origin);
  }, false);
  window.opener.postMessage('authorizing:github', origenPermitido);
})();
</script>
</body>
</html>
HTML;
    exit;
}

/** Pide el token a GitHub. Usa cURL y, si el hosting no lo tiene, file_get_contents. */
function pedir_token(array $datos): ?array
{
    $url = 'https://github.com/login/oauth/access_token';
    $cuerpo = http_build_query($datos);
    $cabeceras = ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded', 'User-Agent: panel-decap-php'];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $cuerpo,
            CURLOPT_HTTPHEADER => $cabeceras,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $respuesta = curl_exec($ch);
        curl_close($ch);
    } else {
        $contexto = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $cabeceras),
            'content' => $cuerpo,
            'timeout' => 15,
            'ignore_errors' => true,
        ]]);
        $respuesta = @file_get_contents($url, false, $contexto);
    }
    $json = is_string($respuesta) ? json_decode($respuesta, true) : null;
    return is_array($json) ? $json : null;
}

if ($clientId === '' || $clientSecret === '' || $origen === '') {
    error_log('auth.php: falta configurar github_oauth_client_id / github_oauth_client_secret.');
    http_response_code(500);
    responder_al_panel('error', ['error' => 'Falta configurar el ingreso con GitHub en el servidor.'], $origen);
}

$opcionesCookie = ['path' => '/api/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax'];

// --- Paso 2: GitHub volvió con el resultado ---
if (isset($_GET['code']) || isset($_GET['error'])) {
    $estadoGuardado = (string) ($_COOKIE[COOKIE_ESTADO] ?? '');
    setcookie(COOKIE_ESTADO, '', ['expires' => time() - 3600] + $opcionesCookie);

    if (isset($_GET['error'])) {
        responder_al_panel('error', ['error' => 'GitHub no autorizó el ingreso.'], $origen);
    }
    // El "state" confirma que la vuelta corresponde al pedido que salió de este navegador.
    $estadoRecibido = (string) ($_GET['state'] ?? '');
    if ($estadoGuardado === '' || !hash_equals($estadoGuardado, $estadoRecibido)) {
        http_response_code(400);
        responder_al_panel('error', ['error' => 'La sesión de ingreso venció. Cerrá esta ventana y probá de nuevo.'], $origen);
    }

    $token = pedir_token([
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'code' => (string) $_GET['code'],
        'redirect_uri' => $urlRetorno,
    ]);
    if (!$token || empty($token['access_token'])) {
        error_log('auth.php: GitHub no devolvió un token (' . (string) ($token['error'] ?? 'sin respuesta') . ').');
        http_response_code(502);
        responder_al_panel('error', ['error' => 'GitHub no devolvió el acceso. Probá de nuevo.'], $origen);
    }
    responder_al_panel('success', ['token' => (string) $token['access_token'], 'provider' => 'github'], $origen);
}

// --- Paso 1: mandamos a GitHub ---
$estado = bin2hex(random_bytes(16));
setcookie(COOKIE_ESTADO, $estado, ['expires' => time() + 600] + $opcionesCookie);

// "repo" es el permiso que necesita el panel para guardar cambios en un repositorio privado.
$alcance = preg_match('/^[a-z_:,\s]+$/', (string) ($_GET['scope'] ?? '')) ? (string) $_GET['scope'] : 'repo';
header('Location: https://github.com/login/oauth/authorize?' . http_build_query([
    'client_id' => $clientId,
    'redirect_uri' => $urlRetorno,
    'scope' => $alcance,
    'state' => $estado,
]), true, 302);
exit;
