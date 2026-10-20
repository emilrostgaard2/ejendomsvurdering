/* ejendomsvurdering.dk — menu, lead-formular, beregner */
(function () {
  'use strict';

  /* Hvor leads sendes hen: BV Leads-plugin'et på boligvurderinger.dk */
  var LEAD_ENDPOINT = 'https://boligvurderinger.dk/wp-json/bv/v1/lead';

  /* Adresseforslag: GSearch fra Klimadatastyrelsen (DAWA's afløser).
     Gratis token: opret bruger på dataforsyningen.dk -> "Mine tokens". Tom = ingen forslag,
     så vises postnr./by-felterne i stedet. */
  var GS_TOKEN = '';
  var GS_URL = 'https://api.dataforsyningen.dk/rest/gsearch/v2.0/adresse';

  /* Eksempler til den "levende" adressetekst i feltet */
  var DEMO = ['Vestergade 12, 8000 Aarhus C', 'Strandvejen 45, 2900 Hellerup', 'Algade 7, 9000 Aalborg',
              'Bøgevej 18, 5000 Odense C', 'Søndergade 3, 7100 Vejle', 'Kongevejen 120, 2830 Virum'];

  /* ---------- mobilmenu ---------- */
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); btn.focus();
      }
    });
  }

  /* ---------- "Få salgsvurdering"-links: hop til den formular, der er synlig ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="#vurdering-s"]');
    if (!a || a.pathname !== location.pathname) return;
    var t = document.getElementById('vurdering-s');
    if (!t || t.offsetParent === null) t = document.getElementById('vurdering-m');
    if (!t) { e.preventDefault(); location.href = '/salgsvurdering/#vurdering-s'; return; }
    e.preventDefault();
    window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
    var i = t.querySelector('input[name=adresse]'); if (i) setTimeout(function () { try { i.focus({ preventScroll: true }); } catch (x) {} }, 450);
  });

  if (location.hash === '#vurdering-s') {
    var hs = document.getElementById('vurdering-s');
    if (hs && hs.offsetParent === null) { var hm = document.getElementById('vurdering-m'); if (hm) setTimeout(function () { window.scrollTo(0, hm.getBoundingClientRect().top + window.pageYOffset - 90); }, 60); }
  }

  /* ---------- mobil: fast CTA-knap, når ingen formular er synlig ---------- */
  var mcta = document.querySelector('.mcta');
  if (mcta && 'IntersectionObserver' in window) {
    var forms = Array.prototype.slice.call(document.querySelectorAll('[data-lead], .calc'));
    var vis = new Set(), scrolled = false;
    function upd() { mcta.classList.toggle('on', scrolled && vis.size === 0); }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? vis.add(e.target) : vis.delete(e.target); }); upd(); });
    forms.forEach(function (f) { io.observe(f); });
    window.addEventListener('scroll', function () { var s = window.pageYOffset > 600; if (s !== scrolled) { scrolled = s; upd(); } }, { passive: true });
  }

  /* ---------- kilde (ingen cookies/lagring: læses kun fra den aktuelle side) ---------- */
  var qs = new URLSearchParams(location.search);
  function src(k) { return qs.get(k) || ''; }
  var ref = (document.referrer && document.referrer.indexOf(location.host) === -1) ? document.referrer : '';

  /* ---------- lead-formularer ---------- */
  document.querySelectorAll('[data-lead]').forEach(initLead);

  function initLead(box) {
    var form = box.querySelector('form');
    var t0 = Date.now();
    var steps = box.querySelectorAll('.lead-step');
    var dots = box.querySelectorAll('.steps li');
    var $ = function (n) { return form.elements[n]; };
    var stopDemo = demoPlaceholder($('adresse'));
    if (GS_TOKEN) initAC(box, $);

    function go(n) {
      steps.forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-step') === String(n)); });
      dots.forEach(function (d, i) { d.classList.toggle('on', i < n); });
      var first = box.querySelector('.lead-step.on input:not([type=hidden]):not(.hp input), .lead-step.on h2, .lead-step.on .lead-title');
      if (n > 1 && first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
      var r = box.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.5) window.scrollTo({ top: r.top + window.pageYOffset - 90, behavior: 'smooth' });
    }

    function bad(el, on, msgId) {
      if (el && el.classList) el.classList.toggle('bad', !!on);
      if (el && el.setAttribute) el.setAttribute('aria-invalid', on ? 'true' : 'false');
      var m = msgId && box.querySelector('[data-err="' + msgId + '"]');
      if (m) m.classList.toggle('on', !!on);
      return !on;
    }

    function v1() {
      var ok = true;
      if (box.classList.contains('ac-on') && !/^\d{4}$/.test($('postnr').value.trim())) {
        /* intet valgt fra listen: vis postnr./by, så man kan skrive selv */
        box.classList.remove('ac-on');
      }
      ok = bad($('adresse'), $('adresse').value.trim().length < 4 || !/\d/.test($('adresse').value), 'adresse') && ok;
      ok = bad($('postnr'), !/^\d{4}$/.test($('postnr').value.trim()), 'postnr') && ok;
      return ok;
    }
    function v2() {
      var ok = true;
      ok = bad($('boligtype'), !$('boligtype').value, 'boligtype') && ok;
      ok = bad($('fornavn'), $('fornavn').value.trim().length < 2, 'fornavn') && ok;
      ok = bad($('efternavn'), $('efternavn').value.trim().length < 2, 'efternavn') && ok;
      ok = bad($('email'), !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('email').value.trim()), 'email') && ok;
      var tlf = $('telefon').value.replace(/\D/g, '');
      ok = bad($('telefon'), tlf.length < 8, 'telefon') && ok;
      var c = $('samtykke_kontakt');
      ok = bad(c, !c.checked, 'samtykke') && ok;
      if (c.closest('.consent')) c.closest('.consent').classList.toggle('bad', !c.checked);
      return ok;
    }

    var next = box.querySelector('[data-next]');
    if (next) next.addEventListener('click', function () {
      if (!v1()) { var f = box.querySelector('.lead-step.on .bad'); if (f) f.focus(); return; }
      var chip = box.querySelector('[data-chip]');
      if (chip) chip.textContent = $('adresse').value.trim() + ', ' + $('postnr').value.trim() + ' ' + $('by').value.trim();
      if (stopDemo) stopDemo();
      go(2);
    });
    var back = box.querySelector('[data-back]');
    if (back) back.addEventListener('click', function () { go(1); });

    /* Enter i trin 1 går videre i stedet for at sende */
    box.querySelectorAll('.lead-step[data-step="1"] input').forEach(function (i) {
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); next && next.click(); } });
    });
    /* fjern fejl, mens man retter */
    form.addEventListener('input', function (e) { if (e.target.classList.contains('bad')) bad(e.target, false, e.target.name === 'samtykke_kontakt' ? 'samtykke' : e.target.name); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (box.querySelector('.lead-step.on').getAttribute('data-step') === '1') { next && next.click(); return; }
      if (!v2()) { var f = box.querySelector('.lead-step.on .bad'); if (f) f.focus(); return; }
      /* simpelt spam-filter: honeypot + mindst 3 sekunder på siden */
      if ($('website').value || Date.now() - t0 < 3000) { go(3); return; }

      var submit = form.querySelector('[type=submit]');
      submit.disabled = true; var txt = submit.innerHTML; submit.textContent = 'Sender …';
      var errBox = box.querySelector('[data-err="send"]');
      if (errBox) errBox.classList.remove('on');

      var p = new URLSearchParams();
      var fn = $('fornavn').value.trim(), ln = $('efternavn').value.trim();
      p.append('adresse', $('adresse').value.trim() + ', ' + $('postnr').value.trim() + ' ' + $('by').value.trim());
      p.append('postnr', $('postnr').value.trim());
      ['vejnavn', 'husnr', 'etage', 'doer', 'kommunekode', 'adresse_id'].forEach(function (k) { if ($(k) && $(k).value) p.append(k, $(k).value); });
      p.append('by', $('by').value.trim());
      p.append('boligtype', $('boligtype').value);
      p.append('fornavn', fn); p.append('efternavn', ln); p.append('fulde_navn', fn + ' ' + ln);
      p.append('email', $('email').value.trim());
      p.append('landekode', $('landekode').value);
      p.append('telefon', $('telefon').value.replace(/\D/g, ''));
      p.append('samtykke_kontakt', '1');
      p.append('samtykke_tekst', box.querySelector('[data-consent-text]').textContent.replace(/\s+/g, ' ').trim());
      p.append('nyhedsbrev', '0');
      p.append('tidspunkt', new Date().toISOString());
      p.append('side', location.href.split('#')[0]);
      p.append('henvisning', ref);
      ['utm_source', 'utm_medium', 'utm_campaign', 'gclid'].forEach(function (k) { p.append(k, src(k)); });
      if (!src('utm_source')) p.set('utm_source', 'ejendomsvurdering.dk');

      function ok() {
        go(3);
        try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'lead', lead_page: location.pathname }); } catch (e) {}
      }
      function fail(msg) {
        submit.disabled = false; submit.innerHTML = txt;
        if (errBox) { errBox.textContent = msg; errBox.classList.add('on'); }
      }

      /* Form-urlencoded = "simple request": ingen CORS-preflight. Svaret kan læses, når
         WordPress sender CORS-headere; gør den ikke, er leadet alligevel modtaget. */
      fetch(LEAD_ENDPOINT, { method: 'POST', body: p, mode: 'cors', credentials: 'omit' })
        .then(function (r) {
          if (r.ok) return ok();
          return r.json().then(function (j) { fail((j && j.message) || 'Noget gik galt. Prøv igen om lidt.'); },
                               function () { fail('Noget gik galt. Prøv igen om lidt.'); });
        })
        .catch(function () { if (navigator.onLine === false) fail('Du ser ud til at være offline. Tjek forbindelsen og prøv igen.'); else ok(); });
    });
  }

  /* ---------- levende placeholder: skriver og sletter eksempeladresser ---------- */
  function demoPlaceholder(input) {
    if (!input || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return function () {};
    var base = input.getAttribute('placeholder'), i = Math.floor(Math.random() * DEMO.length), pos = 0, dir = 1, t = null, stopped = false;
    function tick() {
      if (stopped) return;
      if (document.activeElement === input || input.value) { input.setAttribute('placeholder', base); t = setTimeout(tick, 600); return; }
      var word = DEMO[i], delay;
      pos += dir;
      input.setAttribute('placeholder', word.slice(0, pos) + (pos < word.length || dir < 0 ? '|' : ''));
      if (dir > 0) delay = 55 + Math.random() * 70;
      else delay = 28;
      if (dir > 0 && pos >= word.length) { dir = -1; delay = 1900; }
      else if (dir < 0 && pos <= 0) { dir = 1; i = (i + 1) % DEMO.length; delay = 450; }
      t = setTimeout(tick, delay);
    }
    t = setTimeout(tick, 900);
    input.addEventListener('focus', function () { input.setAttribute('placeholder', base); });
    return function () { stopped = true; clearTimeout(t); input.setAttribute('placeholder', base); };
  }

  /* ---------- adresseforslag (GSearch) ---------- */
  function initAC(box, $) {
    var input = $('adresse'), list = box.querySelector('.ac-list');
    if (!input || !list || !window.fetch) return;
    box.classList.add('ac-on');
    var items = [], idx = -1, timer = null, ctrl = null, lastQ = '';
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

    function parse(o) {
      var label = o.visningstekst || o.betegnelse || '';
      var m = label.match(/^(.*?),\s*(?:([^,]*?),\s*)?(\d{4})\s+(.+)$/);
      var street = m ? (m[2] ? m[1] + ', ' + m[2] : m[1]) : label;
      return {
        label: label, street: street,
        postnr: String(o.postnummer || (m && m[3]) || ''),
        by: o.postnummernavn || (m && m[4]) || '',
        vejnavn: o.vejnavn || '', husnr: o.husnummer || o.husnummertekst || '',
        etage: o.etagebetegnelse || o.etage || '', doer: o.doerbetegnelse || o.doer || '',
        kommunekode: o.kommunekode || '', id: o.id || o.adresseid || ''
      };
    }
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); idx = -1; input.removeAttribute('aria-activedescendant'); }
    function render(q) {
      if (!items.length) { list.innerHTML = '<li class="ac-empty">Ingen adresser fundet. Prøv fx “' + esc(q) + ' 12”.</li>'; list.hidden = false; return; }
      var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(/\s+/).filter(Boolean).join('|') + ')', 'gi');
      list.innerHTML = items.map(function (a, n) {
        return '<li role="option" id="' + list.id + '-' + n + '" data-i="' + n + '"><span class="ac-st">' + esc(a.street).replace(re, '<b>$1</b>') + '</span><span class="ac-pb">' + esc(a.postnr + ' ' + a.by) + '</span></li>';
      }).join('');
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    function mark(n) {
      var lis = list.querySelectorAll('[role=option]');
      lis.forEach(function (li, k) { li.classList.toggle('on', k === n); li.setAttribute('aria-selected', k === n ? 'true' : 'false'); });
      idx = n;
      if (lis[n]) { input.setAttribute('aria-activedescendant', lis[n].id); lis[n].scrollIntoView({ block: 'nearest' }); }
    }
    function pick(n) {
      var a = items[n]; if (!a) return;
      input.value = a.street; $('postnr').value = a.postnr; $('by').value = a.by;
      ['vejnavn', 'husnr', 'etage', 'doer', 'kommunekode'].forEach(function (k) { $(k).value = a[k] || ''; });
      $('adresse_id').value = a.id || '';
      input.classList.remove('bad'); var em = box.querySelector('[data-err="adresse"]'); if (em) em.classList.remove('on');
      close();
      if (!/\d/.test(a.street)) { input.focus(); input.value = a.street + ' '; return; } /* vej uden husnr.: skriv videre */
      var nb = box.querySelector('[data-next]'); if (nb) nb.focus();
    }
    function search(q) {
      if (ctrl) ctrl.abort();
      ctrl = window.AbortController ? new AbortController() : null;
      fetch(GS_URL + '?q=' + encodeURIComponent(q) + '&limit=8', { headers: { token: GS_TOKEN }, signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) {
          if (q !== lastQ) return;
          items = (Array.isArray(d) ? d : []).map(parse).filter(function (a) { return a.label; });
          render(q); if (items.length) mark(0);
        })
        .catch(function (e) { if (e && e.name === 'AbortError') return; box.classList.remove('ac-on'); close(); });
    }
    input.addEventListener('input', function () {
      $('postnr').value = ''; $('by').value = ''; $('adresse_id').value = '';
      var q = input.value.trim(); lastQ = q;
      clearTimeout(timer);
      if (q.length < 2) { close(); return; }
      timer = setTimeout(function () { search(q); }, 140);
    });
    input.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      var n = list.querySelectorAll('[role=option]').length;
      if (e.key === 'ArrowDown') { e.preventDefault(); mark((idx + 1) % n); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark((idx - 1 + n) % n); }
      else if (e.key === 'Enter' && idx > -1) { e.preventDefault(); e.stopImmediatePropagation(); pick(idx); }
      else if (e.key === 'Escape') { close(); }
    });
    list.addEventListener('mousedown', function (e) { var li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(+li.getAttribute('data-i')); } });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
  }

  /* ---------- beregner: ejendomsværdiskat + grundskyld ---------- */
  var calc = document.getElementById('calc');
  if (calc) {
    var cfg = JSON.parse(calc.getAttribute('data-cfg'));
    var fmt = function (n) { return Math.round(n).toLocaleString('da-DK') + ' kr.'; };
    var num = function (el) { return parseFloat(String(el.value).replace(/\./g, '').replace(/\s/g, '').replace(',', '.')) || 0; };
    var out = document.getElementById('calc-out');
    function run() {
      var ev = num(calc.elements.ejendomsvaerdi);
      var gv = num(calc.elements.grundvaerdi);
      var promille = parseFloat(String(calc.elements.promille.value).replace(',', '.')) || 0;
      var pens = calc.elements.pensionist && calc.elements.pensionist.checked;
      var basis = ev * cfg.andel;                       // beregningsgrundlag (80 %)
      var lav = Math.min(basis, cfg.graense);
      var hoj = Math.max(0, basis - cfg.graense);
      var evs = lav * cfg.sats_lav + hoj * cfg.sats_hoj;
      var gs = gv * cfg.andel * promille / 1000;
      if (!ev && !gv) { out.hidden = true; return; }
      out.hidden = false;
      out.querySelector('[data-o="total"]').textContent = fmt(evs + gs);
      out.querySelector('[data-o="md"]').textContent = fmt((evs + gs) / 12);
      out.querySelector('[data-o="basis"]').textContent = fmt(basis);
      out.querySelector('[data-o="evs"]').textContent = fmt(evs);
      out.querySelector('[data-o="gbasis"]').textContent = fmt(gv * cfg.andel);
      out.querySelector('[data-o="gs"]').textContent = fmt(gs);
      var pn = out.querySelector('[data-o="pens"]');
      if (pn) pn.hidden = !pens;
    }
    ['ejendomsvaerdi', 'grundvaerdi'].forEach(function (n) {
      var el = calc.elements[n];
      el.addEventListener('blur', function () { var v = num(el); el.value = v ? Math.round(v).toLocaleString('da-DK') : ''; });
    });
    calc.addEventListener('input', run);
    calc.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  }
})();
