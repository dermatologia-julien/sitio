/**
 * Login del panel (/admin) con GitHub, para hosting Netlify.
 *
 * Equivale a php/api/auth.php (DonWeb). Decap CMS abre esta función en una ventanita:
 *   1. Sin "code": mandamos a la persona a GitHub para que autorice.
 *   2. GitHub vuelve acá con un "code": lo cambiamos por un token (del lado del servidor, con el secreto).
 *   3. Le pasamos el token a la ventana del panel y esta ventanita se cierra sola.
 *
 * Necesita una "OAuth App" de GitHub (en la organización dermatologia-julien) cuya
 * "Authorization callback URL" sea  https://<dominio del sitio>/.netlify/functions/auth
 * El Client ID y el Client Secret se cargan como variables de entorno en Netlify:
 *   GITHUB_OAUTH_CLIENT_ID y GITHUB_OAUTH_CLIENT_SECRET. Nunca en el repositorio.
 */

const COOKIE_ESTADO = 'julien_oauth_estado';
const RUTA_COOKIE = '/.netlify/functions/';

const cabecerasPrivadas = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON seguro para incrustar dentro de <script>.
const jsonSeguro = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/'/g, '\\u0027');

/** Página final: le avisa el resultado a la ventana del panel con el formato que espera Decap. */
function responderAlPanel(estado, contenido, origen, status = 200, extraHeaders = {}) {
  const mensaje = `authorization:github:${estado}:${JSON.stringify(contenido)}`;
  const texto = estado === 'success'
    ? 'Listo. Ya podés volver al panel; esta ventana se cierra sola.'
    : `No pudimos iniciar la sesión: ${escHtml(contenido.error || 'error desconocido')}`;
  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Ingreso al panel</title></head>
<body style="font-family: sans-serif; padding: 24px;">
<p>${texto}</p>
<script>
(function () {
  var mensaje = ${jsonSeguro(mensaje)};
  var origenPermitido = ${jsonSeguro(origen)};
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
</html>`;
  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8', ...cabecerasPrivadas });
  for (const [k, v] of Object.entries(extraHeaders)) headers.append(k, v);
  return new Response(html, { status, headers });
}

const cookie = (valor, maxAge) =>
  `${COOKIE_ESTADO}=${valor}; Path=${RUTA_COOKIE}; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;

function leerCookie(req) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE_ESTADO}=([a-f0-9]+)`));
  return m ? m[1] : '';
}

function igualSeguro(a, b) {
  if (a.length !== b.length || a.length === 0) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default async (req) => {
  const url = new URL(req.url);
  const origen = url.origin;
  const urlRetorno = `${origen}/.netlify/functions/auth`;
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    console.error('auth: faltan GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET.');
    return responderAlPanel('error', { error: 'Falta configurar el ingreso con GitHub en el servidor.' }, origen, 500);
  }

  // --- Paso 2: GitHub volvió con el resultado ---
  if (url.searchParams.has('code') || url.searchParams.has('error')) {
    const borrar = { 'Set-Cookie': cookie('', 0) };
    if (url.searchParams.has('error')) {
      return responderAlPanel('error', { error: 'GitHub no autorizó el ingreso.' }, origen, 200, borrar);
    }
    // El "state" confirma que la vuelta corresponde al pedido que salió de este navegador.
    if (!igualSeguro(leerCookie(req), url.searchParams.get('state') || '')) {
      return responderAlPanel('error', { error: 'La sesión de ingreso venció. Cerrá esta ventana y probá de nuevo.' }, origen, 400, borrar);
    }
    let token = null;
    try {
      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'panel-decap-netlify' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: url.searchParams.get('code'), redirect_uri: urlRetorno }),
      });
      token = await r.json();
    } catch (e) {
      console.error('auth: error al pedir el token a GitHub.', e);
    }
    if (!token || !token.access_token) {
      console.error(`auth: GitHub no devolvió un token (${token && token.error ? token.error : 'sin respuesta'}).`);
      return responderAlPanel('error', { error: 'GitHub no devolvió el acceso. Probá de nuevo.' }, origen, 502, borrar);
    }
    return responderAlPanel('success', { token: token.access_token, provider: 'github' }, origen, 200, borrar);
  }

  // --- Paso 1: mandamos a GitHub ---
  const estado = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  // "repo" es el permiso que necesita el panel para guardar cambios en un repositorio privado.
  const pedido = url.searchParams.get('scope') || '';
  const alcance = /^[a-z_:,\s]+$/.test(pedido) ? pedido : 'repo';
  const destino = `https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: clientId, redirect_uri: urlRetorno, scope: alcance, state: estado })}`;
  return new Response(null, { status: 302, headers: { Location: destino, 'Set-Cookie': cookie(estado, 600), ...cabecerasPrivadas } });
};
