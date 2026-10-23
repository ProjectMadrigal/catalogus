/**
 * app.js
 * De publieke catalogus: lijst, zoeken, filters en de detailpagina per boek.
 * De gegevens laden één keer. Zoeken en filteren gebeurt daarna in de browser.
 *
 * Adressen (alles na het #-teken, zodat GitHub Pages geen extra pagina's nodig heeft):
 *   #/                     de lijst
 *   #/?q=baldwin&taal=Engels   de lijst met een zoekopdracht en filters
 *   #/boek/B0012           de detailpagina van een boek (vaste link om te delen)
 *   #/privacy              de privacyverklaring
 */
(function () {
  'use strict';

  var Z = window.MadrigalZoeken;
  var F = window.MadrigalFilters;
  var D = window.MadrigalDom;
  var el = D.el;

  var PER_KEER = 40; // zoveel boeken tonen we per keer

  var staat = {
    data: null,
    index: [],
    perId: {},
    keuzes: { q: '', beschikbaar: false, sorteer: 'relevantie' },
    getoond: PER_KEER,
    laatsteLijstAdres: '#/',
    laatstGeopend: null,
    scrollPositie: 0
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Adres (hash) lezen en schrijven ---------- */

  function leesAdres() {
    var hash = location.hash.replace(/^#\/?/, '');
    var m = hash.match(/^boek\/([A-Za-z0-9\-]+)/);
    if (m) return { scherm: 'boek', id: decodeURIComponent(m[1]) };
    if (hash.indexOf('privacy') === 0) return { scherm: 'privacy' };
    var params = new URLSearchParams(hash.replace(/^\?/, ''));
    var keuzes = { q: params.get('q') || '', beschikbaar: params.get('beschikbaar') === 'ja', sorteer: params.get('sorteer') || 'relevantie' };
    F.FILTERS.forEach(function (f) { if (params.get(f.sleutel)) keuzes[f.sleutel] = params.get(f.sleutel); });
    return { scherm: 'lijst', keuzes: keuzes };
  }

  function lijstAdres() {
    var params = new URLSearchParams();
    if (staat.keuzes.q) params.set('q', staat.keuzes.q);
    F.FILTERS.forEach(function (f) { if (staat.keuzes[f.sleutel]) params.set(f.sleutel, staat.keuzes[f.sleutel]); });
    if (staat.keuzes.beschikbaar) params.set('beschikbaar', 'ja');
    if (staat.keuzes.sorteer !== 'relevantie') params.set('sorteer', staat.keuzes.sorteer);
    var p = params.toString();
    return '#/' + (p ? '?' + p : '');
  }

  function bewaarAdres() {
    staat.laatsteLijstAdres = lijstAdres();
    if (location.hash !== staat.laatsteLijstAdres && !(location.hash === '' && staat.laatsteLijstAdres === '#/')) {
      history.replaceState(null, '', staat.laatsteLijstAdres);
    }
  }

  /* ---------- Gegevens ---------- */

  function ontvang(data) {
    staat.data = data;
    staat.index = Z.maakIndex(data.boeken);
    staat.perId = {};
    data.boeken.forEach(function (b) { staat.perId[b.id] = b; });
    $('voorbeeld-melding').hidden = window.MadrigalApi.isGekoppeld();
    var t = data.teksten || {};
    if (t.welkom) $('welkom').textContent = t.welkom;
    $('uitleg-lenen').textContent = t.uitleg || '';
    $('privacy-tekst').textContent = t.privacy || '';
    $('laden').hidden = true;
    var eerste = !staat.geladen;
    staat.geladen = true;
    bouwFilters();
    if (eerste) { toonScherm(); return; }
    // Verse gegevens na de bewaarde versie: stil bijwerken, zonder focus of invoer te verstoren.
    var adres = leesAdres();
    if (adres.scherm === 'lijst') toonLijst();
    else if (adres.scherm === 'boek') toonDetail(adres.id);
  }

  function fout() {
    $('laden').textContent = 'De catalogus kon niet laden. Kijk of je internet hebt en vernieuw de pagina.';
    $('aantal').textContent = 'De catalogus kon niet laden.';
  }

  /* ---------- Filters ---------- */

  function bouwFilters() {
    var opties = F.opties(staat.data.boeken, staat.data.filtergroepen);
    var raster = $('filterraster');
    D.vervang(raster, F.FILTERS.map(function (f) {
      var id = 'filter-' + f.sleutel;
      var select = el('select', { id: id, onchange: function () { staat.keuzes[f.sleutel] = this.value; nieuweLijst(); } },
        el('option', { value: '' }, 'Alle'),
        opties[f.sleutel].map(function (o) {
          return el('option', { value: o.waarde, selected: staat.keuzes[f.sleutel] === o.waarde }, o.waarde + ' (' + o.aantal + ')');
        }));
      return el('div', { class: 'veld' }, el('label', { for: id }, f.label), select);
    }));
    $('filter-beschikbaar').checked = staat.keuzes.beschikbaar;
  }

  function zetFormulier() {
    $('zoek').value = staat.keuzes.q;
    $('sorteer').value = staat.keuzes.sorteer;
    $('filter-beschikbaar').checked = staat.keuzes.beschikbaar;
    F.FILTERS.forEach(function (f) {
      var s = $('filter-' + f.sleutel);
      if (s) s.value = staat.keuzes[f.sleutel] || '';
    });
  }

  function aantalActieveFilters() {
    var n = staat.keuzes.beschikbaar ? 1 : 0;
    F.FILTERS.forEach(function (f) { if (staat.keuzes[f.sleutel]) n++; });
    return n;
  }

  /* ---------- Lijst ---------- */

  function resultaten() {
    var gevonden = Z.zoek(staat.index, staat.keuzes.q).map(function (r) { return r.boek; });
    var gefilterd = F.pasToe(gevonden, staat.keuzes);
    var wijze = staat.keuzes.sorteer;
    if (wijze === 'relevantie' && !staat.keuzes.q.trim()) wijze = 'titel';
    return F.sorteer(gefilterd, wijze);
  }

  function nieuweLijst() {
    staat.getoond = PER_KEER;
    toonLijst();
    bewaarAdres();
  }

  function toonLijst() {
    if (!staat.data) return;
    var lijst = resultaten();
    var zichtbaar = lijst.slice(0, staat.getoond);
    D.vervang($('resultaten'), zichtbaar.map(boekKaart));
    var n = lijst.length;
    $('aantal').textContent = n === 0
      ? 'Geen boeken gevonden. Probeer een ander woord of wis de filters.'
      : n + (n === 1 ? ' boek' : ' boeken') + ' gevonden' + (n > zichtbaar.length ? ', ' + zichtbaar.length + ' getoond' : '');
    var meer = $('meer');
    meer.hidden = n <= zichtbaar.length;
    meer.textContent = 'Toon meer boeken (nog ' + (n - zichtbaar.length) + ')';
    var actief = aantalActieveFilters();
    $('filter-teller').textContent = actief ? '(' + actief + ' actief)' : '';
  }

  function cover(b, groot) {
    var letter = (Z.sorteerTekst(b.t).charAt(0) || '?').toUpperCase();
    var plaatshouder = el('div', { class: 'plaatshouder' + (b.s === 'zine' ? ' zine' : ''), 'aria-hidden': 'true' }, letter);
    if (!b.c) return plaatshouder;
    var img = el('img', {
      class: 'cover', src: b.c, alt: groot ? 'Cover van ' + b.t : '', loading: 'lazy', decoding: 'async',
      width: groot ? 192 : 72, height: groot ? 288 : 108
    });
    img.addEventListener('error', function () { if (img.parentNode) img.parentNode.replaceChild(plaatshouder, img); });
    return img;
  }

  function meta(b) {
    return [b.j, b.l, b.u].filter(Boolean).join(' · ');
  }

  function labels(b) {
    var items = [el('li', {}, D.statusLabel(b.b.c, b.b.l))];
    (b.r || []).forEach(function (naam) { items.push(el('li', {}, el('span', { class: 'label label-aanrader' }, 'Aanrader van ' + naam))); });
    return el('ul', { class: 'labels', 'aria-label': 'Labels' }, items);
  }

  function boekKaart(b) {
    return el('li', { class: 'boek' },
      cover(b, false),
      el('div', {},
        el('h3', {}, el('a', { href: '#/boek/' + encodeURIComponent(b.id), 'data-id': b.id }, b.t)),
        b.a ? el('p', { class: 'auteur' }, b.a) : null,
        meta(b) ? el('p', { class: 'meta' }, meta(b)) : null,
        labels(b)));
  }

  /* ---------- Detailpagina ---------- */

  function toonDetail(id) {
    var b = staat.perId[id];
    var scherm = $('detail-scherm');
    var terug = el('a', { class: 'terug', href: staat.laatsteLijstAdres }, '← Terug naar de catalogus');
    if (!b) {
      D.vervang(scherm, terug, el('div', { class: 'blok' },
        el('h2', { tabindex: '-1' }, 'Dit boek vonden we niet'),
        el('p', {}, 'Misschien is het uit de catalogus gehaald. Zoek in de catalogus naar een ander boek.')));
      document.title = 'Boek niet gevonden · Project Madrigal';
      return;
    }
    var rijen = [
      ['Jaartal', b.j], ['Taal', b.l], ['Uitgeverij', b.u], ["Pagina's", b.p], ['Uitvoering', b.v],
      ['Staat', b.n === 'nieuw' ? 'Nieuw' : (b.n === 'tweedehands' ? 'Tweedehands' : '')], ['ISBN', b.i],
      ['Soort', b.s === 'zine' ? 'Zine' : '']
    ].filter(function (r) { return r[1]; });

    var onderwerpen = (b.g || []).map(function (g) {
      return el('li', {}, el('a', { class: 'label label-onderwerp', href: '#/?groep=' + encodeURIComponent(g) }, g));
    });
    var uitlegStatus = {
      beschikbaar: 'Kom langs aan de balie om dit boek te lenen.',
      uitgeleend: 'Vraag aan de balie om het te reserveren. Je krijgt het als eerste in de wachtrij zodra het terug is.',
      gereserveerd: 'Iemand wacht al op dit boek. Je kan aan de balie ook in de wachtrij staan.',
      niet_uitleenbaar: ''
    }[b.b.c] || '';

    var deelKnop = el('button', { type: 'button', class: 'knop tweede', onclick: function () { deel(b); } }, 'Deel dit boek');

    D.vervang($('detail-scherm'), terug, el('article', { class: 'blok detail' },
      el('div', {}, cover(b, true)),
      el('div', {},
        el('h2', { tabindex: '-1' }, b.t),
        b.a ? el('p', { class: 'auteur' }, b.a) : null,
        el('p', { class: 'beschikbaarheid' }, D.statusLabel(b.b.c, b.b.l)),
        uitlegStatus ? el('p', {}, uitlegStatus) : null,
        (b.r || []).length ? el('ul', { class: 'labels' }, b.r.map(function (n) {
          return el('li', {}, el('a', { class: 'label label-aanrader', href: '#/?aanrader=' + encodeURIComponent('Aanrader van ' + n) }, 'Aanrader van ' + n));
        })) : null,
        b.d ? el('p', {}, b.d) : null,
        el('dl', { class: 'gegevens' }, rijen.map(function (r) { return [el('dt', {}, r[0]), el('dd', {}, String(r[1]))]; })),
        onderwerpen.length ? el('div', {}, el('h3', {}, 'Onderwerpen'), el('ul', { class: 'labels' }, onderwerpen)) : null,
        el('div', { class: 'knoppen' }, deelKnop),
        el('p', { class: 'hulptekst', id: 'deel-melding', 'aria-live': 'polite' }))));
    document.title = b.t + ' · Project Madrigal';
  }

  function deel(b) {
    var url = location.href.split('#')[0] + '#/boek/' + encodeURIComponent(b.id);
    if (navigator.share) {
      navigator.share({ title: b.t, text: b.t + (b.a ? ' van ' + b.a : '') + ' in de catalogus van Project Madrigal', url: url }).catch(function () {});
      return;
    }
    var melding = $('deel-melding');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { melding.textContent = 'De link is gekopieerd.'; },
        function () { melding.textContent = 'Kopieer deze link: ' + url; });
    } else {
      melding.textContent = 'Kopieer deze link: ' + url;
    }
  }

  /* ---------- Schermen wisselen ---------- */

  function toonScherm() {
    var adres = leesAdres();
    var lijst = $('lijst-scherm'), detail = $('detail-scherm'), privacy = $('privacy-scherm');
    lijst.hidden = adres.scherm !== 'lijst';
    detail.hidden = adres.scherm !== 'boek';
    privacy.hidden = adres.scherm !== 'privacy';

    if (adres.scherm === 'lijst') {
      document.title = 'Catalogus · Project Madrigal';
      var vorigeKeuzes = JSON.stringify(staat.keuzes);
      staat.keuzes = adres.keuzes;
      if (JSON.stringify(staat.keuzes) !== vorigeKeuzes) staat.getoond = PER_KEER;
      staat.laatsteLijstAdres = lijstAdres();
      zetFormulier();
      toonLijst();
      // Terug van een detailpagina: zelfde plek en focus op hetzelfde boek.
      if (staat.laatstGeopend) {
        window.scrollTo(0, staat.scrollPositie);
        var link = document.querySelector('[data-id="' + CSS.escape(staat.laatstGeopend) + '"]');
        if (link) link.focus({ preventScroll: true });
        staat.laatstGeopend = null;
      }
    } else if (adres.scherm === 'boek') {
      if (!staat.data) return;
      toonDetail(adres.id);
      window.scrollTo(0, 0);
      var kop = detail.querySelector('h2');
      if (kop) kop.focus({ preventScroll: true });
    } else {
      document.title = 'Privacy · Project Madrigal';
      window.scrollTo(0, 0);
      privacy.querySelector('h2').focus({ preventScroll: true });
    }
  }

  /* ---------- Gebeurtenissen ---------- */

  function vertraag(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function start() {
    var adres = leesAdres();
    if (adres.scherm === 'lijst') staat.keuzes = adres.keuzes;
    zetFormulier();

    $('zoek').addEventListener('input', vertraag(function () {
      staat.keuzes.q = $('zoek').value;
      nieuweLijst();
    }, 180));
    $('zoekformulier').addEventListener('submit', function (e) {
      e.preventDefault();
      staat.keuzes.q = $('zoek').value;
      nieuweLijst();
      // Enter in het zoekveld: naar het eerste resultaat.
      var eerste = $('resultaten').querySelector('h3 a');
      if (eerste) eerste.focus();
    });
    $('sorteer').addEventListener('change', function () { staat.keuzes.sorteer = this.value; nieuweLijst(); });
    $('filter-beschikbaar').addEventListener('change', function () { staat.keuzes.beschikbaar = this.checked; nieuweLijst(); });
    $('wis-filters').addEventListener('click', function () {
      F.FILTERS.forEach(function (f) { delete staat.keuzes[f.sleutel]; });
      staat.keuzes.beschikbaar = false;
      zetFormulier();
      nieuweLijst();
    });
    $('meer').addEventListener('click', function () {
      var eerste = staat.getoond;
      staat.getoond += PER_KEER;
      toonLijst();
      // Focus naar het eerste nieuwe boek, zodat toetsenbordgebruikers verder kunnen.
      var links = $('resultaten').querySelectorAll('h3 a');
      if (links[eerste]) links[eerste].focus();
    });
    $('resultaten').addEventListener('click', function (e) {
      var a = e.target.closest('a[data-id]');
      if (a) { staat.laatstGeopend = a.getAttribute('data-id'); staat.scrollPositie = window.scrollY; }
    });
    window.addEventListener('hashchange', toonScherm);

    window.MadrigalApi.haalCatalogus(ontvang, fout);
  }

  start();
})();
