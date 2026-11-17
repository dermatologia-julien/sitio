/* Dermatología Julién · interacciones (sin dependencias) */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  // Si la persona pidió menos movimiento en su sistema, no animamos los desplazamientos.
  var mqMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function scrollMode() { return mqMotion && mqMotion.matches ? 'auto' : 'smooth'; }

  // ---- menú mobile ----
  var toggle = $('.menu-toggle');
  var nav = $('#menu');
  function setMenu(open) {
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  }
  function menuOpen() { return !!toggle && toggle.getAttribute('aria-expanded') === 'true'; }
  if (toggle) {
    var header = $('.site-header');
    toggle.addEventListener('click', function () { setMenu(!menuOpen()); });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (!menuOpen()) return;
      // Escape cierra el menú y devuelve el foco al botón.
      if (e.key === 'Escape') { setMenu(false); toggle.focus(); return; }
      // Con el menú abierto, Tab recorre solo el encabezado (logo, links y botón).
      if (e.key !== 'Tab') return;
      var items = $$('a[href], button', header).filter(function (el) { return el.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (!header.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // Al pasar a escritorio el menú vuelve a su estado normal.
    if (window.matchMedia) {
      var mqDesk = window.matchMedia('(min-width: 1081px)');
      var onDesk = function () { if (mqDesk.matches) setMenu(false); };
      if (mqDesk.addEventListener) mqDesk.addEventListener('change', onDesk); else if (mqDesk.addListener) mqDesk.addListener(onDesk);
    }
  }

  // ---- "Ver todas" / "Ver los N tratamientos" (mobile) ----
  $$('.show-all').forEach(function (b) {
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', b.dataset.target);
    b.addEventListener('click', function () {
      var list = document.getElementById(b.dataset.target);
      list.classList.add('is-expanded');
      b.setAttribute('aria-expanded', 'true');
      b.hidden = true;
      b.style.setProperty('display', 'none', 'important');
      var firstExtra = $('.is-extra', list);
      if (firstExtra) { var f = $('a, button', firstExtra); if (f) f.focus({ preventScroll: true }); }
    });
  });

  // ---- desplegable "+" de cada tratamiento ----
  $$('.tx-more').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!open));
      document.getElementById(b.getAttribute('aria-controls')).hidden = open;
    });
  });

  // ---- "Ver opciones" de cada preocupación ----
  var dlg = $('#concern-dialog');
  var data = (window.JULIEN && window.JULIEN.tratamientos) || {};
  function showTreatment(id) {
    var el = document.getElementById('t-' + id);
    if (!el) return;
    var list = el.closest('.tx-list');
    if (list && !list.classList.contains('is-expanded')) {
      list.classList.add('is-expanded');
      var btn = document.querySelector('.show-all[data-target="' + list.id + '"]');
      if (btn) { btn.hidden = true; btn.style.setProperty('display', 'none', 'important'); }
    }
    el.scrollIntoView({ behavior: scrollMode(), block: 'center' });
    // El foco pasa al tratamiento elegido para seguir desde ahí con el teclado o el lector de pantalla.
    try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
    el.classList.add('is-highlight');
    setTimeout(function () { el.classList.remove('is-highlight'); }, 2200);
  }
  if (dlg && typeof dlg.showModal === 'function') {
    $$('[data-concern]').forEach(function (b) {
      b.addEventListener('click', function () {
        var card = b.closest('.concern');
        $('#cd-title', dlg).textContent = $('h3', card).textContent;
        var ul = $('.cd-list', dlg);
        ul.innerHTML = '';
        var seen = {};
        (b.dataset.ids || '').split(' ').forEach(function (id) {
          if (!id || seen[id] || !data[id]) return;
          seen[id] = 1;
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = '#t-' + id;
          var s = document.createElement('strong'); s.textContent = data[id].n;
          var p = document.createElement('span'); p.textContent = data[id].d;
          a.appendChild(s); a.appendChild(p);
          a.addEventListener('click', function (e) {
            e.preventDefault();
            dlg.close();
            // Esperamos a que el diálogo devuelva el foco antes de moverlo al tratamiento.
            setTimeout(function () { showTreatment(id); }, 0);
          });
          li.appendChild(a); ul.appendChild(li);
        });
        dlg.showModal();
      });
    });
    $('.cd-close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  } else {
    // Navegadores sin <dialog>: ir directo a los tratamientos.
    $$('[data-concern]').forEach(function (b) {
      b.addEventListener('click', function () { var id = (b.dataset.ids || '').split(' ')[0]; if (id) showTreatment(id); });
    });
  }

  // ---- carrusel de reseñas ----
  $$('[data-carousel]').forEach(function (c) {
    var track = $('.reviews', c);
    var items = $$('.review', track);
    var dots = $('.dots', c);
    var prev = $('.c-prev', c);
    var next = $('.c-next', c);
    function perView() {
      var first = items[0];
      if (!first) return 1;
      return Math.max(1, Math.round(track.clientWidth / first.getBoundingClientRect().width));
    }
    function pages() { return Math.max(1, items.length - perView() + 1); }
    function current() {
      var w = items[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
      return Math.round(track.scrollLeft / w);
    }
    function go(i) {
      i = Math.max(0, Math.min(pages() - 1, i));
      track.scrollTo({ left: items[i].offsetLeft - items[0].offsetLeft, behavior: scrollMode() });
    }
    // Los puntos se crean una sola vez; después solo se actualiza su estado (así no se pierde el foco).
    var dotBtns = items.map(function (_, k) {
      var d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', 'Ir a la reseña ' + (k + 1) + ' de ' + items.length);
      d.addEventListener('click', function () { go(Math.min(k, pages() - 1)); });
      dots.appendChild(d);
      return d;
    });
    function render() {
      var pv = perView();
      var cur = current();
      dotBtns.forEach(function (d, i) {
        if (i >= cur && i < cur + pv) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      prev.disabled = cur <= 0;
      next.disabled = cur >= pages() - 1;
      c.querySelector('.carousel-nav').style.display = pages() > 1 ? '' : 'none';
    }
    prev.addEventListener('click', function () { go(current() - 1); });
    next.addEventListener('click', function () { go(current() + 1); });
    var t;
    track.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(render, 60); }, { passive: true });
    window.addEventListener('resize', render);
    render();
  });

  // ---- mapa diferido (carga el iframe al acercarse) ----
  var map = $('.map[data-map-src]');
  if (map) {
    var loadMap = function () {
      if (map.dataset.loaded) return;
      map.dataset.loaded = '1';
      var f = document.createElement('iframe');
      f.src = map.dataset.mapSrc;
      f.title = 'Ubicación del consultorio en Google Maps';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      map.appendChild(f);
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { loadMap(); io.disconnect(); } }, { rootMargin: '400px' });
      io.observe(map);
    } else { loadMap(); }
  }

  // ---- formulario: envío sin recargar ----
  var form = $('.contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      var status = $('.form-status', form);
      if (form.dataset.preview) {
        e.preventDefault();
        status.textContent = 'Vista previa: el formulario se activa al publicar el sitio.';
        return;
      }
      if (!window.fetch) return;
      e.preventDefault();
      var btn = $('button[type="submit"]', form);
      btn.disabled = true;
      status.textContent = '';
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch(form.getAttribute('action'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body: body })
        .then(function (r) {
          if (r.ok) { form.reset(); status.textContent = status.dataset.ok; return; }
          // El formulario propio (PHP) explica qué dato hay que corregir.
          return r.json().catch(function () { return {}; }).then(function (d) {
            status.textContent = (d && d.error) || 'No pudimos enviar tu consulta. Probá de nuevo o escribinos por WhatsApp.';
          });
        })
        .catch(function () {
          status.textContent = 'No pudimos enviar tu consulta. Probá de nuevo o escribinos por WhatsApp.';
        })
        .then(function () { btn.disabled = false; });
    });
  }
})();
