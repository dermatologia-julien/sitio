// Build del sitio Dermatología Julién.
// Node 18+ sin dependencias: lee content/*.json y genera dist/.
//
// Uso: FORM_MODE=netlify node build.mjs   → hosting en Netlify (formulario con Netlify Forms)
//      FORM_MODE=php node build.mjs       → hosting en DonWeb (copia php/ a dist/: formulario, login del panel y .htaccess)
//      FORM_MODE=none node build.mjs      → vista previa local (el formulario no envía nada)
//
// Variable opcional: SITE_URL=https://qa.dermatologiajulien.com.ar
//   Solo para FORM_MODE=php. Es la dirección donde va a quedar publicado este build
//   (sirve para el login del panel en un subdominio de pruebas). Si no se pasa, usa content/datos.json.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const FORM_MODE = process.env.FORM_MODE || 'netlify';
if (!['netlify', 'php', 'none'].includes(FORM_MODE)) {
  console.error(`FORM_MODE inválido: "${FORM_MODE}". Valores posibles: netlify, php o none.`);
  process.exit(1);
}

// ---------- utilidades ----------
const readJSON = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const slug = (s) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const telDigits = (t) => String(t).replace(/\D/g, '');
// Celular de AMBA: 11 XXXX-XXXX -> 54 9 11 XXXXXXXX
const waNumber = (t) => { const d = telDigits(t); return d.startsWith('54') ? d : `549${d}`; };
const waLink = (t, msg) => `https://wa.me/${waNumber(t)}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;

// Imágenes: si existen variantes optimizadas (scripts/optimizar-fotos.py) se usan con srcset.
const OPT_DIR = join(ROOT, '.optimizadas');
const WIDTHS = [480, 800, 1200, 1600];
function picture(src, { alt = '', cls = '', pos = '', sizes = '100vw', eager = false } = {}) {
  if (!src) return '';
  const base = basename(src, extname(src));
  const avail = WIDTHS.filter((w) => existsSync(join(OPT_DIR, `${base}-${w}.webp`)));
  const style = pos ? ` style="object-position:${esc(pos)}"` : '';
  const load = eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  if (!avail.length) {
    return `<img src="${esc(src)}" alt="${esc(alt)}" class="${cls}"${style} ${load}>`;
  }
  const webp = avail.map((w) => `/img/opt/${base}-${w}.webp ${w}w`).join(', ');
  const jpg = avail.map((w) => `/img/opt/${base}-${w}.jpg ${w}w`).join(', ');
  const fallback = `/img/opt/${base}-${avail[Math.min(1, avail.length - 1)]}.jpg`;
  return `<picture><source type="image/webp" srcset="${webp}" sizes="${sizes}">`
    + `<img src="${fallback}" srcset="${jpg}" sizes="${sizes}" alt="${esc(alt)}" class="${cls}"${style} ${load}></picture>`;
}

const icon = {
  cal: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  arrow: '<svg class="ic ic-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  wa: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8.4 19z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9a5 5 0 0 1-2.8-2.8l.9-1-1-2z" class="fill"/></svg>',
  pin: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  plus: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 8v8M8 12h8" class="v"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
  chevL: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  chevR: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  menu: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18M3 16h18"/></svg>',
  close: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
};

// ---------- contenido ----------
const datos = readJSON('content/datos.json');
const inicio = readJSON('content/inicio.json');
const sectores = readJSON('content/sectores.json');
const preocupaciones = readJSON('content/preocupaciones.json');
const equipo = readJSON('content/equipo.json');
const resenas = readJSON('content/resenas.json');
const turnos = readJSON('content/turnos.json');

const SECTOR_ORDEN = ['clinica', 'estetica', 'capilar', 'corporal'];
const tratamientos = readdirSync(join(ROOT, 'content/tratamientos'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ id: basename(f, '.json'), ...readJSON(`content/tratamientos/${f}`) }))
  .filter((t) => t.visible !== false && SECTOR_ORDEN.includes(t.sector))
  .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre, 'es'));
const tratamientoPorId = Object.fromEntries(tratamientos.map((t) => [t.id, t]));

const AGENDA = datos.agenda_url;
const WA_TURNOS = waLink(datos.whatsapp_turnos, datos.whatsapp_turnos_mensaje);
const WA_TIENDA = waLink(datos.whatsapp_tienda);
const matriculas = `M.N. ${datos.matricula_nacional} · M.P. ${datos.matricula_provincial}`;
const ext = 'target="_blank" rel="noopener"';

// ---------- secciones ----------
const btn = (href, label, { variant = 'primary', ic = 'cal', cls = '', external = true } = {}) =>
  `<a class="btn btn-${variant} ${cls}" href="${esc(href)}" ${external ? ext : ''}>${ic ? icon[ic] : ''}<span>${esc(label)}</span></a>`;

function header() {
  const nav = [
    ...SECTOR_ORDEN.map((k) => [`#${k}`, sectores[k].menu || sectores[k].titulo]),
    ['#especialista', equipoVisible().length > 1 ? 'Nuestro equipo' : 'La especialista'],
    ['#turnos', 'Turnos'],
    [datos.tienda_url, 'Tienda'],
  ];
  const links = nav.map(([h, l]) => `<li><a href="${esc(h)}"${h.startsWith('http') ? ` ${ext}` : ''}>${esc(l)}</a></li>`).join('');
  return `
<header class="site-header" id="top">
  <div class="wrap header-inner">
    <a class="brand" href="#top" aria-label="${esc(datos.nombre_sitio)} — inicio">
      <img src="/img/logo-horizontal.png" alt="${esc(datos.nombre_sitio)}" width="140" height="60">
    </a>
    <nav class="main-nav" id="menu" aria-label="Principal">
      <ul>${links}</ul>
      <div class="nav-mobile-cta">${btn(AGENDA, inicio.portada.cta, { cls: 'btn-block' })}</div>
    </nav>
    ${btn(AGENDA, inicio.portada.cta, { cls: 'header-cta' })}
    <button class="menu-toggle" type="button" aria-controls="menu" aria-expanded="false" aria-label="Abrir menú">${icon.menu}${icon.close}</button>
  </div>
</header>`;
}

function hero() {
  const p = inicio.portada;
  return `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-text">
      <h1>${esc(p.titulo)}</h1>
      <p class="lead">${esc(p.subtitulo)}</p>
      <div class="hero-ctas">
        ${btn(AGENDA, p.cta, { cls: 'hero-main-cta' })}
        <a class="btn btn-outline" href="#preocupaciones">${esc(p.boton_preocupaciones)}</a>
        <a class="btn btn-outline" href="#tratamientos"><span class="d-only">${esc(p.boton_tratamientos)}</span><span class="m-only">${esc(p.boton_tratamientos_mobile || p.boton_tratamientos)}</span></a>
      </div>
      <p class="matriculas">${esc(datos.profesional)} · ${esc(matriculas)}</p>
    </div>
    <div class="hero-media">
      <div class="drop">${picture(p.foto, { alt: p.foto_alt, pos: p.foto_posicion, sizes: '(max-width: 760px) 70vw, 480px', eager: true })}</div>
    </div>
  </div>
  <svg class="curve" viewBox="0 0 1400 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 175 C 330 120, 640 40, 880 38 C 1080 36, 1240 120, 1400 175"/></svg>
</section>`;
}

function recorrido() {
  const items = inicio.recorrido.map((t, i) => `<li${i === 0 ? ' class="is-active"' : ''}><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="step">${esc(t)}</span></li>`).join('');
  return `<section class="recorrido" aria-label="Cómo trabajamos"><div class="wrap"><ol>${items}</ol></div></section>`;
}

function preocupacionesSec() {
  const s = inicio.preocupaciones;
  const visibles = preocupaciones.items.filter((p) => p.visible !== false);
  const cards = visibles.map((p, i) => {
    const ops = (p.opciones || []).filter((o) => tratamientoPorId[o.tratamiento]);
    const chips = ops.map((o) => `<li>${esc(o.etiqueta || tratamientoPorId[o.tratamiento].nombre)}</li>`).join(' ');
    const ids = ops.map((o) => o.tratamiento).join(' ');
    return `<li class="concern${i >= 6 ? ' is-extra' : ''}">
      <h3>${esc(p.titulo)}</h3>
      <ul class="chips">${chips}</ul>
      <button type="button" class="link-arrow" data-concern="${i}" data-ids="${esc(ids)}" aria-haspopup="dialog" aria-label="Ver opciones: ${esc(p.titulo)}">Ver opciones ${icon.arrow}</button>
    </li>`;
  }).join('');
  const more = visibles.length > 6 ? `<button type="button" class="link-under m-only show-all" data-target="concerns">Ver todas (${visibles.length})</button>` : '';
  return `
<section class="sec sec-ivory" id="preocupaciones">
  <div class="wrap">
    <div class="sec-head">
      <div><p class="eyebrow d-only">${esc(s.etiqueta)}</p><h2>${esc(s.titulo)}</h2></div>
      <p class="sec-intro"><span class="d-only">${esc(s.intro)}</span><span class="m-only">${esc(s.intro_mobile || s.intro)}</span></p>
    </div>
    <ul class="concerns" id="concerns">${cards}</ul>
    ${more}
  </div>
  <dialog class="concern-dialog" id="concern-dialog" aria-labelledby="cd-title">
    <div class="cd-inner">
      <button type="button" class="cd-close" aria-label="Cerrar">${icon.close}</button>
      <p class="eyebrow">Opciones de atención</p>
      <h3 id="cd-title"></h3>
      <ul class="cd-list"></ul>
      <p class="cd-note">La indicación siempre depende de la evaluación médica.</p>
      ${btn(AGENDA, inicio.tratamientos.cta_sector)}
    </div>
  </dialog>
</section>`;
}

function sectoresSec() {
  const s = inicio.tratamientos;
  const bloques = SECTOR_ORDEN.map((key, idx) => {
    const sec = sectores[key];
    const items = tratamientos.filter((t) => t.sector === key);
    const lis = items.map((t, i) => {
      const hasMore = t.ampliado && t.ampliado.trim();
      const pid = `amp-${t.id}`;
      return `<li class="tx${i >= 3 ? ' is-extra' : ''}" id="t-${esc(t.id)}" tabindex="-1">
        <div class="tx-main">
          <h4>${esc(t.nombre)}${hasMore ? ` <button type="button" class="tx-more" aria-expanded="false" aria-controls="${pid}" aria-label="Más información sobre ${esc(t.nombre)}">${icon.plus}</button>` : ''}</h4>
          <p>${esc(t.descripcion)}</p>
          ${hasMore ? `<div class="tx-amp" id="${pid}" hidden><p>${esc(t.ampliado).replace(/\n+/g, '</p><p>')}</p></div>` : ''}
        </div>
        <a class="link-arrow tx-cta" href="${esc(AGENDA)}" ${ext} aria-label="${esc(s.cta_item)}: ${esc(t.nombre)}">${esc(s.cta_item)} ${icon.arrow}</a>
      </li>`;
    }).join('');
    const more = items.length > 3 ? `<button type="button" class="btn btn-outline btn-block m-only show-all" data-target="list-${key}">Ver los ${items.length} tratamientos</button>` : '';
    return `
    <article class="sector${idx % 2 ? ' is-reverse' : ''}" id="${key}">
      <div class="sector-media">${picture(sec.foto, { alt: sec.foto_alt, pos: sec.foto_posicion, sizes: '(max-width: 760px) 100vw, 480px' })}</div>
      <div class="sector-body">
        <p class="num">${String(idx + 1).padStart(2, '0')}</p>
        <h3>${esc(sec.titulo)}</h3>
        <p class="sector-frase">${esc(sec.frase)}</p>
        <ul class="tx-list" id="list-${key}">${lis}</ul>
        ${more}
        ${btn(AGENDA, s.cta_sector, { cls: 'd-only-flex sector-cta' })}
      </div>
    </article>`;
  }).join('');
  return `
<section class="sec sec-ivory sec-tratamientos" id="tratamientos">
  <div class="wrap">
    <div class="sec-head">
      <div><p class="eyebrow d-only">${esc(s.etiqueta)}</p><h2>${esc(s.titulo)}</h2></div>
      <p class="sec-intro"><span class="d-only">${esc(s.intro)}</span><span class="m-only">${esc(s.intro_mobile || s.intro)}</span></p>
    </div>
    ${bloques}
  </div>
</section>`;
}

function franjaCta() {
  const f = inicio.franja_cta;
  return `
<section class="cta-band">
  <div class="wrap cta-band-inner">
    <div><h2>${esc(f.titulo)}</h2><p>${esc(f.texto)}</p></div>
    ${btn(AGENDA, f.boton)}
  </div>
</section>`;
}

function equipoVisible() { return (equipo.perfiles || []).filter((p) => p.visible !== false).slice(0, 12); }

function perfilCompleto(p, etiqueta, tag = 'h3') {
  const tl = (p.trayectoria || []).map((t) => `<li><span class="yr">${esc(t.anio)}</span><span><strong>${esc(t.titulo)}</strong>${t.detalle ? `<small>${esc(t.detalle)}</small>` : ''}</span></li>`).join('');
  return `
    <div class="profile">
      <div class="profile-media">${picture(p.foto, { alt: p.foto_alt || p.nombre, pos: p.foto_posicion, sizes: '(max-width: 760px) 100vw, 512px' })}</div>
      <div class="profile-body">
        ${etiqueta ? `<p class="eyebrow">${esc(etiqueta)}</p>` : ''}
        <${tag} class="profile-name">${esc(p.nombre)}</${tag}>
        <p class="profile-text">${esc(p.texto)}</p>
        ${tl ? `<ul class="timeline">${tl}</ul>` : ''}
        ${p.frase ? `<blockquote>"${esc(p.frase)}"</blockquote>` : ''}
        ${p.matriculas ? `<p class="small">${esc(p.matriculas)}</p>` : ''}
      </div>
    </div>`;
}

function especialistaSec() {
  const perfiles = equipoVisible();
  if (!perfiles.length) return '';
  if (perfiles.length === 1) {
    return `<section class="sec sec-green" id="especialista" aria-label="La especialista"><div class="wrap">${perfilCompleto(perfiles[0], 'La especialista', 'h2')}</div></section>`;
  }
  const [principal, ...resto] = perfiles;
  const cards = resto.map((p) => `
    <li class="team-card">
      <div class="team-media">${picture(p.foto, { alt: p.foto_alt || p.nombre, pos: p.foto_posicion, sizes: '(max-width: 760px) 100vw, 360px' })}</div>
      <h4>${esc(p.nombre)}</h4>
      <p>${esc(p.texto)}</p>
      ${p.matriculas ? `<p class="small">${esc(p.matriculas)}</p>` : ''}
    </li>`).join('');
  return `
<section class="sec sec-green" id="especialista" aria-labelledby="eq-title">
  <div class="wrap">
    <h2 id="eq-title" class="team-title">Nuestro equipo</h2>
    ${perfilCompleto(principal, '')}
    <ul class="team-grid">${cards}</ul>
  </div>
</section>`;
}

function resenasSec() {
  const r = inicio.resenas;
  const items = (resenas.items || []).filter((x) => x.visible !== false);
  if (!items.length) return '';
  const cards = items.map((x) => {
    const n = Math.max(0, Math.min(5, Number(x.estrellas) || 5));
    return `<li class="review">
      <div class="stars" role="img" aria-label="${n} de 5 estrellas">${icon.star.repeat(n)}</div>
      <blockquote>“${esc(x.texto)}”</blockquote>
      <p class="who"><strong>${esc(x.nombre)}</strong><small>Reseña de Google</small></p>
    </li>`;
  }).join('');
  return `
<section class="sec sec-ivory" id="resenas">
  <div class="wrap">
    <div class="sec-head sec-head-end">
      <h2>${esc(r.titulo)}</h2>
      <p class="reviews-src"><span>${esc(r.subtitulo)}</span> <a class="link-under d-only" href="${esc(datos.google_resenas_url)}" ${ext}>${esc(r.link)}</a></p>
    </div>
    <div class="carousel" data-carousel>
      <ul class="reviews" tabindex="0" aria-label="Reseñas de pacientes (se puede desplazar con las flechas del teclado)">${cards}</ul>
      <div class="carousel-nav">
        <button type="button" class="c-prev" aria-label="Reseñas anteriores">${icon.chevL}</button>
        <div class="dots" role="group" aria-label="Elegir reseña"></div>
        <button type="button" class="c-next" aria-label="Reseñas siguientes">${icon.chevR}</button>
      </div>
    </div>
    <p class="m-only center"><a class="link-under" href="${esc(datos.google_resenas_url)}" ${ext}>${esc(r.link)}</a></p>
  </div>
</section>`;
}

function turnosSec() {
  const t = turnos;
  const pasos = t.pasos.map((p, i) => `
      <li><span class="num">${i + 1}</span>
        <h4><span class="d-only">${esc(p.titulo)}</span><span class="m-only"><span class="paso-n">${i + 1}.</span> ${esc(p.titulo_mobile || p.titulo)}</span></h4>
        <p><span class="d-only">${esc(p.texto)}</span><span class="m-only">${esc(p.texto_mobile || p.texto)}</span></p></li>`).join('');
  const cob = t.coberturas.map((c) => `<li>${esc(c)}</li>`).join('');
  const osde = datos.osde_url ? ` <a class="link-under" href="${esc(datos.osde_url)}" ${ext}>Agenda online de OSDE</a>.` : '';
  const mapa = `https://www.google.com/maps?q=${encodeURIComponent(datos.mapa_busqueda)}&output=embed`;
  const mapaLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(datos.mapa_busqueda)}`;
  return `
<section class="sec sec-white" id="turnos">
  <div class="wrap">
    <h2 class="turnos-title">${esc(t.titulo)}</h2>
    <div class="turnos-grid">
      <div class="consulta-card">
        <p class="eyebrow d-only">${esc(t.consulta.etiqueta)}</p>
        <h3>${esc(t.consulta.titulo)}</h3>
        <p class="d-only">${esc(t.consulta.texto)}</p>
        <p class="precio">Consulta particular: <strong>${esc(t.consulta.precio)}</strong></p>
        ${btn(AGENDA, t.consulta.boton, { variant: 'light' })}
      </div>
      <div class="turnos-info">
        <h3 class="eyebrow"><span class="d-only">${esc(t.pasos_titulo)}</span><span class="m-only">${esc(t.pasos_titulo_mobile || t.pasos_titulo)}</span></h3>
        <ol class="pasos">${pasos}</ol>
        <h3 class="eyebrow">${esc(t.coberturas_titulo)}</h3>
        <ul class="coberturas">${cob}</ul>
        <p class="nota">${esc(t.coberturas_nota)}${osde} <span class="d-only">Consultas por WhatsApp a secretaría: ${esc(datos.whatsapp_turnos)}.</span></p>
        <a class="btn btn-outline btn-block m-only-flex" href="${esc(WA_TURNOS)}" ${ext}>${icon.wa}<span>WhatsApp ${esc(datos.whatsapp_turnos)}</span></a>
      </div>
    </div>
    <div class="ubicacion">
      <div class="map" data-map-src="${esc(mapa)}">
        <a class="map-fallback" href="${esc(mapaLink)}" ${ext} aria-label="Ver en Google Maps">${icon.pin}<span>Ver en Google Maps</span></a>
      </div>
      <div class="ubicacion-info">
        <p class="eyebrow d-only">Dirección</p>
        <p class="big">${esc(datos.direccion_linea1)}<span class="d-only"><br></span><span class="m-only"> · </span>${esc(datos.direccion_linea2)}</p>
        <p class="eyebrow d-only">Días de atención</p>
        <p class="big">${esc(datos.dias_atencion)}</p>
        <p class="muted d-only">${esc(datos.horarios)}</p>
        <a class="btn btn-outline btn-block d-only-flex" href="${esc(WA_TURNOS)}" ${ext}>${icon.wa}<span>${esc(t.boton_whatsapp)}</span></a>
      </div>
    </div>
  </div>
</section>`;
}

function tiendaSec() {
  const t = inicio.tienda;
  return `
<section class="tienda-band" id="tienda">
  <div class="wrap tienda-inner">
    <div class="tienda-media">${picture(t.foto, { alt: t.foto_alt, sizes: '150px' })}</div>
    <div class="tienda-text">
      <p class="eyebrow">${esc(t.etiqueta)}</p>
      <h2><span class="d-only">${esc(t.titulo)}</span><span class="m-only">${esc(t.titulo_mobile || t.titulo)}</span></h2>
      <a class="link-under m-only" href="${esc(datos.tienda_url)}" ${ext}>${esc(t.link_mobile)}</a>
    </div>
    <div class="tienda-ctas d-only-flex">
      <a class="btn btn-outline" href="${esc(datos.tienda_productos_url || datos.tienda_url)}" ${ext}>${esc(t.boton_productos)}</a>
      <a class="btn btn-outline" href="${esc(datos.tienda_tratamientos_url || datos.tienda_url)}" ${ext}>${esc(t.boton_tratamientos)}</a>
    </div>
  </div>
</section>`;
}

function contactoSec() {
  const c = inicio.contacto;
  const formAttrs = FORM_MODE === 'netlify'
    ? 'method="POST" data-netlify="true" netlify-honeypot="empresa" action="/gracias/"'
    : FORM_MODE === 'php' ? 'method="POST" action="/api/contacto.php"' : 'method="POST" action="#" data-preview="true"';
  return `
<section class="sec sec-white" id="contacto">
  <div class="wrap contacto-grid">
    <div class="contacto-text">
      <h2><span class="d-only">${esc(c.titulo).replace(/\? /, '?<br>')}</span><span class="m-only">${esc(c.titulo_mobile || c.titulo)}</span></h2>
      <p class="d-only">${esc(c.texto)}</p>
      <div class="d-only contacto-ctas">
        ${btn(AGENDA, inicio.portada.cta)}
        <a class="btn btn-outline" href="${esc(WA_TURNOS)}" ${ext}>${icon.wa}<span>${esc(c.boton_whatsapp)}</span></a>
      </div>
    </div>
    <form class="contact-form" name="contacto" ${formAttrs}>
      <input type="hidden" name="form-name" value="contacto">
      <p class="hp" aria-hidden="true"><label>Empresa <input name="empresa" tabindex="-1" autocomplete="off"></label></p>
      <label>Nombre y apellido<input name="nombre" required autocomplete="name"></label>
      <label>Email<input type="email" name="email" required autocomplete="email"></label>
      <label>Teléfono<input type="tel" name="telefono" autocomplete="tel"></label>
      <label>Tu consulta<textarea name="consulta" rows="4" required></textarea></label>
      <button class="btn btn-primary btn-block-m" type="submit">${esc(c.boton_enviar)}</button>
      <p class="form-status" role="status" aria-live="polite" data-ok="${esc(c.mensaje_ok)}"></p>
    </form>
  </div>
</section>`;
}

function footer() {
  const f = inicio.footer;
  const trat = SECTOR_ORDEN.map((k) => `<li><a href="#${k}">${esc(sectores[k].titulo.replace(' y tratamientos corporales', ' y corporales'))}</a></li>`).join('');
  return `
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <img src="/img/logo-horizontal-negativo.png" alt="${esc(datos.nombre_sitio)}" width="160" height="62" loading="lazy">
      <p>${esc(f.frase)}</p>
    </div>
    <div class="d-only"><h2>Tratamientos</h2><ul>${trat}</ul></div>
    <div><h2 class="d-only">Consultorio</h2><ul>
      <li class="d-only">${esc(datos.direccion_linea1)}</li><li class="d-only">${esc(datos.direccion_linea2)}</li>
      <li><a href="${esc(WA_TURNOS)}" ${ext}>Turnos ${esc(datos.whatsapp_turnos)}</a></li>
      <li class="m-only"><a href="${esc(WA_TIENDA)}" ${ext}>Tienda ${esc(datos.whatsapp_tienda)}</a></li>
      <li><a href="mailto:${esc(datos.email)}">${esc(datos.email)}</a></li>
      <li class="m-only">${esc(datos.direccion_linea1)} · Nordelta</li>
      <li class="m-only"><a href="https://www.instagram.com/${esc(datos.instagram)}/" ${ext}>Instagram @${esc(datos.instagram)}</a></li>
    </ul></div>
    <div class="d-only"><h2>Accesos</h2><ul>
      <li><a href="${esc(datos.turnero_registrados_url)}" ${ext}>Turnos online</a></li>
      <li><a href="${esc(datos.tienda_url)}" ${ext}>Tienda Julién</a> · <a href="${esc(WA_TIENDA)}" ${ext}>${esc(datos.whatsapp_tienda)}</a></li>
      <li><a href="https://www.instagram.com/${esc(datos.instagram)}/" ${ext}>Instagram @${esc(datos.instagram)}</a></li>
    </ul></div>
  </div>
  <div class="wrap footer-legal"><p><span class="d-only">${esc(datos.profesional)} · </span>${esc(matriculas)}<span class="d-only"> · ${esc(f.legal)}</span></p></div>
</footer>
<a class="wa-float" href="${esc(WA_TURNOS)}" ${ext} aria-label="Escribinos por WhatsApp">${icon.wa}</a>
<div class="mobile-bar">
  ${btn(AGENDA, inicio.portada.cta, { cls: 'mobile-bar-cta' })}
  <a class="mobile-bar-wa" href="${esc(WA_TURNOS)}" ${ext} aria-label="WhatsApp de secretaría">${icon.wa}</a>
</div>`;
}

function jsonLd() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: datos.nombre_sitio,
    url: datos.url_sitio,
    image: datos.url_sitio + (datos.seo_imagen || ''),
    telephone: `+${waNumber(datos.whatsapp_turnos)}`,
    email: datos.email,
    medicalSpecialty: 'Dermatology',
    address: {
      '@type': 'PostalAddress',
      streetAddress: datos.direccion_linea1,
      addressLocality: 'Nordelta, Tigre',
      addressRegion: 'Buenos Aires',
      addressCountry: 'AR',
    },
    sameAs: [`https://www.instagram.com/${datos.instagram}/`],
  };
  return `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}

function page() {
  const url = datos.url_sitio;
  const datosJs = { tratamientos: Object.fromEntries(tratamientos.map((t) => [t.id, { n: t.nombre, d: t.descripcion }])) };
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(datos.seo_titulo)}</title>
<meta name="description" content="${esc(datos.seo_descripcion)}">
<link rel="canonical" href="${esc(url)}/">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${esc(datos.seo_titulo)}">
<meta property="og:description" content="${esc(datos.seo_descripcion)}">
<meta property="og:url" content="${esc(url)}/">
<meta property="og:image" content="${esc(url + (datos.seo_imagen || ''))}">
<meta name="theme-color" content="#145F5C">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">
<link rel="icon" type="image/png" sizes="512x512" href="/img/favicon-512.png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="preload" href="/fonts/cormorant-600.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/fonts/lato-400.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="/css/styles.css?v=${BUILD_ID}">
${jsonLd()}
</head>
<body>
<a class="skip" href="#main">Saltar al contenido</a>
${header()}
<main id="main" tabindex="-1">
${hero()}
${recorrido()}
${preocupacionesSec()}
${sectoresSec()}
${franjaCta()}
${especialistaSec()}
${resenasSec()}
${turnosSec()}
${tiendaSec()}
${contactoSec()}
</main>
${footer()}
<script>window.JULIEN=${JSON.stringify(datosJs).replace(/</g, '\\u003c')};</script>
<script src="/js/main.js?v=${BUILD_ID}" defer></script>
</body>
</html>`;
}

function gracias() {
  return `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gracias · ${esc(datos.nombre_sitio)}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/css/styles.css?v=${BUILD_ID}"></head>
<body class="page-simple"><main class="wrap simple"><img src="/img/logo-horizontal.png" alt="${esc(datos.nombre_sitio)}" width="160" height="68">
<h1>¡Gracias!</h1><p>${esc(inicio.contacto.mensaje_ok)}</p><a class="btn btn-primary" href="/">Volver al sitio</a></main></body></html>`;
}

// ---------- salida ----------
const BUILD_ID = Date.now().toString(36);
if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'static'), DIST, { recursive: true });
cpSync(join(ROOT, 'src/styles.css'), join(DIST, 'css/styles.css'));
cpSync(join(ROOT, 'src/main.js'), join(DIST, 'js/main.js'));
if (existsSync(join(ROOT, 'uploads'))) cpSync(join(ROOT, 'uploads'), join(DIST, 'uploads'), { recursive: true });
if (existsSync(OPT_DIR)) cpSync(OPT_DIR, join(DIST, 'img/opt'), { recursive: true });
if (existsSync(join(ROOT, 'admin'))) cpSync(join(ROOT, 'admin'), join(DIST, 'admin'), { recursive: true });
writeFileSync(join(DIST, 'index.html'), page());
mkdirSync(join(DIST, 'gracias'), { recursive: true });
writeFileSync(join(DIST, 'gracias/index.html'), gracias());
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${datos.url_sitio}/sitemap.xml\n`);
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${datos.url_sitio}/</loc></url></urlset>\n`);

// ---------- extras según el hosting ----------
if (FORM_MODE === 'php') {
  // DonWeb: se suman el formulario (api/contacto.php), el login del panel (api/auth.php) y los .htaccess.
  const PHP_DIR = join(ROOT, 'php');
  if (!existsSync(PHP_DIR)) { console.error('Falta la carpeta php/.'); process.exit(1); }
  cpSync(PHP_DIR, DIST, { recursive: true });
  // La configuración real (con secretos) nunca sale del repo: vive solo en el servidor o en los secrets de GitHub.
  for (const f of ['api/config.php', 'api/config.ejemplo.php']) if (existsSync(join(DIST, f))) rmSync(join(DIST, f));
  // Datos públicos que usa contacto.php como valores por defecto.
  const siteUrl = (process.env.SITE_URL || datos.url_sitio).replace(/\/+$/, '');
  writeFileSync(join(DIST, 'api/sitio.json'), JSON.stringify({ nombre: datos.nombre_sitio, url: siteUrl, email: datos.email }, null, 2));
  // El panel entra por api/auth.php: se activan base_url y auth_endpoint en la copia publicada de config.yml.
  const cfgPath = join(DIST, 'admin/config.yml');
  let cfg = readFileSync(cfgPath, 'utf8');
  const antes = cfg;
  cfg = cfg.replace(/^(\s*)# base_url:.*$/m, `$1base_url: ${siteUrl}`).replace(/^(\s*)# auth_endpoint:.*$/m, '$1auth_endpoint: api/auth.php');
  if (cfg === antes || !/^\s*base_url:/m.test(cfg) || !/^\s*auth_endpoint:/m.test(cfg)) {
    console.error('No se pudieron activar base_url y auth_endpoint en admin/config.yml (faltan las líneas comentadas).');
    process.exit(1);
  }
  writeFileSync(cfgPath, cfg);
}

if (FORM_MODE === 'netlify') {
  // Netlify: el panel entra por la función netlify/functions/auth.mjs del mismo sitio.
  // Netlify define URL (dirección principal del sitio) durante el build; afuera de Netlify se usa la de datos.json.
  const siteUrl = (process.env.URL || datos.url_sitio).replace(/\/+$/, '');
  const cfgPath = join(DIST, 'admin/config.yml');
  let cfg = readFileSync(cfgPath, 'utf8');
  const antes = cfg;
  cfg = cfg.replace(/^(\s*)# base_url:.*$/m, `$1base_url: ${siteUrl}`).replace(/^(\s*)# auth_endpoint:.*$/m, '$1auth_endpoint: .netlify/functions/auth');
  if (cfg === antes || !/^\s*base_url:/m.test(cfg) || !/^\s*auth_endpoint:/m.test(cfg)) {
    console.error('No se pudieron activar base_url y auth_endpoint en admin/config.yml (faltan las líneas comentadas).');
    process.exit(1);
  }
  writeFileSync(cfgPath, cfg);
}

console.log(`OK · ${tratamientos.length} tratamientos · ${equipoVisible().length} perfil(es) · form=${FORM_MODE} · dist/`);
