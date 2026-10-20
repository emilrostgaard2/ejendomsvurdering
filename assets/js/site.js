/* ejendomsvurdering.dk — menu, lead-formular, beregner */
(function () {
  'use strict';

  /* Hvor leads sendes hen: BV Leads-plugin'et på boligvurderinger.dk */
  var LEAD_ENDPOINT = 'https://boligvurderinger.dk/wp-json/bv/v1/lead';

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
