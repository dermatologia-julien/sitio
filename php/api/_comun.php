<?php
/**
 * Funciones compartidas por auth.php y contacto.php.
 * No se puede abrir directo desde el navegador (lo bloquea .htaccess y además no imprime nada).
 */

declare(strict_types=1);

/** Lee un valor de api/config.php y, si no está, de una variable de entorno con el mismo nombre en mayúsculas. */
function cfg(string $clave, string $porDefecto = ''): string
{
    static $config = null;
    if ($config === null) {
        $ruta = __DIR__ . '/config.php';
        $leido = is_file($ruta) ? include $ruta : [];
        $config = is_array($leido) ? $leido : [];
    }
    $valor = $config[$clave] ?? '';
    if (is_string($valor) && trim($valor) !== '') {
        return trim($valor);
    }
    $env = getenv(strtoupper($clave));
    if (is_string($env) && trim($env) !== '') {
        return trim($env);
    }
    return $porDefecto;
}

/** Datos públicos del sitio que deja el build en api/sitio.json (nombre, url y email). */
function datos_sitio(): array
{
    $ruta = __DIR__ . '/sitio.json';
    $datos = is_file($ruta) ? json_decode((string) file_get_contents($ruta), true) : null;
    return is_array($datos) ? $datos : [];
}

/** Dominio con el que se pidió la página, validado para no confiar en cabeceras raras. */
function host_actual(): string
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    return preg_match('/^[a-z0-9.-]+(:\d+)?$/', $host) ? $host : '';
}

/** Origen del sitio (https://dominio), sin barra final. */
function origen_sitio(): string
{
    $configurado = rtrim(cfg('sitio_origen'), '/');
    if ($configurado !== '') {
        return $configurado;
    }
    $host = host_actual();
    return $host !== '' ? 'https://' . $host : '';
}

/** Cabeceras para que nada de esto quede guardado en caché ni indexado. */
function cabeceras_privadas(): void
{
    header('Cache-Control: no-store, max-age=0');
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
}
