/**
 * bestuur-beheer.js
 * De onderdelen van het bestuursscherm die de website aanpassen:
 *   - Boeken: een boek zoeken en aanpassen, of een nieuw boek toevoegen (met opzoeken via het ISBN);
 *   - Nieuws en agenda: ook de veelgestelde vragen;
 *   - Teksten en instellingen.
 * Alles komt in de spreadsheet terecht (zie apps-script/Beheer.js).
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;
  var B = root.MadrigalBeheer;
  var Z = root.MadrigalZoeken;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Hulp ---------- */

  var LABELS = {
    titel: 'Titel', auteur: 'Auteur', isbn: 'ISBN', soort: 'Soort', uitgeverij: 'Uitgeverij', jaartal: 'Jaartal',
    taal: 'Taal', paginas: 'Pagina\'s', uitvoering: 'Uitvoering', nieuwstaat: 'Nieuw of tweedehands',
    aanrader: 'Aanrader van', genre: 'Genre', extra_onderwerpen: 'Extra onderwerpen', klassieker: 'Klassieker',
    aantal: 'Aantal exemplaren', uitleenbaar: 'Uitleenbaar', publiek: 'Op de website', status: 'Status',
    startpagina: 'Op de startpagina', beschrijving: 'Beschrijving (Nederlands)', beschrijving_en: 'Beschrijving (Engels)',
    cover_url: 'Link naar de cover', herkomst: 'Herkomst',
    datum: 'Datum', uur: 'Uur', titel_en: 'Titel (Engels)', tekst: 'Tekst', tekst_en: 'Tekst (Engels)',
    locatie: 'Locatie', afbeelding: 'Link naar een afbeelding', link: 'Link voor meer info',
    volgorde: 'Volgorde', vraag: 'Vraag', vraag_en: 'Vraag (Engels)', antwoord: 'Antwoord', antwoord_en: 'Antwoord (Engels)'
  };

  var HULP = {
    auteur: 'Achternaam eerst: Verbeek, Mira',
    aanrader: 'Voornamen, gescheiden door komma\'s. Wordt het label "Aanrader van ..."',
    extra_onderwerpen: 'Extra filtergroepen, gescheiden door komma\'s',
    status: 'Verloren: niet op de website, niet uitleenbaar. Gevoelig verborgen: niet op de website, wel uitleenbaar. Gevoelig zichtbaar: met het label "Gevoelige inhoud".',
    startpagina: 'Automatisch: als aanrader of als het nieuw binnen is',
    beschrijving_en: 'Leeg laten: dan vertaalt het script de Nederlandse tekst',
    herkomst: 'Nooit publiek: donatie, schenker, ... Enkel zichtbaar in de spreadsheet',
    publiek: 'Nee: blijft bewaard, maar verschijnt niet op de website',
    tekst_en: 'Leeg laten: dan toont de site het Nederlands',
    volgorde: 'Kleinste getal eerst'
  };

  var KEUZES = {
    soort: [['boek', 'Boek'], ['zine', 'Zine']],
    nieuwstaat: [['', 'Onbekend'], ['ja', 'Nieuw'], ['nee', 'Tweedehands']],
    klassieker: [['', 'Nee'], ['ja', 'Ja']],
    uitleenbaar: [['ja', 'Ja'], ['nee', 'Nee']],
    publiek: [['ja', 'Ja'], ['nee', 'Nee, verborgen']],
    startpagina: [['', 'Automatisch'], ['ja', 'Altijd'], ['nee', 'Nooit']],
    status: [['', 'Gewoon'], ['verloren', 'Verloren'], ['gevoelig verborgen', 'Gevoelig, verborgen'], ['gevoelig zichtbaar', 'Gevoelig, zichtbaar met label']]
  };

  var LANG = ['beschrijving', 'beschrijving_en', 'tekst', 'tekst_en', 'antwoord', 'antwoord_en'];
  var GETAL = ['jaartal', 'paginas', 'aantal', 'volgorde'];

  /** Eén veld van een formulier. Geeft { blok, lees } terug. */
  function veld(prefix, naam, waarde) {
    var id = prefix + '-' + naam;
    var w = waarde === undefined || waarde === null ? '' : String(waarde);
    var invoer;
    if (KEUZES[naam]) {
      invoer = el('select', { id: id }, KEUZES[naam].map(function (k) {
        return el('option', { value: k[0], selected: k[0] === w }, k[1]);
      }));
      // Een waarde die niet in de lijst staat (bv. zelf getypt in de spreadsheet), toch tonen.
      if (w && !KEUZES[naam].some(function (k) { return k[0] === w; })) invoer.appendChild(el('option', { value: w, selected: true }, w));
    } else if (LANG.indexOf(naam) > -1) {
      invoer = el('textarea', { id: id, rows: '5' });
      invoer.value = w;
    } else {
      var type = naam === 'datum' ? 'date' : GETAL.indexOf(naam) > -1 ? 'number' : /url|afbeelding|link/.test(naam) ? 'url' : 'text';
      invoer = el('input', { type: type, id: id, value: w, autocomplete: 'off' });
      if (type === 'number') { invoer.setAttribute('min', '0'); invoer.setAttribute('inputmode', 'numeric'); }
    }
    var hulpId = HULP[naam] ? id + '-hulp' : null;
    if (hulpId) invoer.setAttribute('aria-describedby', hulpId);
    var blok = el('div', { class: 'veld' }, el('label', { for: id }, LABELS[naam] || naam),
      hulpId ? el('p', { class: 'hulptekst', id: hulpId }, HULP[naam]) : null, invoer);
    return { naam: naam, blok: blok, invoer: invoer, oud: w, lees: function () { return invoer.value; } };
  }

  /** Enkel de velden die veranderden (of alles bij iets nieuws). */
  function gewijzigd(velden, alles) {
    var uit = {};
    velden.forEach(function (v) { if (alles || v.lees() !== v.oud) uit[v.naam] = v.lees(); });
    return uit;
  }

  function knoppen() {
    return el('div', { class: 'knoppen' }, Array.prototype.slice.call(arguments));
  }

  /* ---------- Boeken ---------- */

  var GROEPEN_BOEK = [
    ['Het boek', ['titel', 'auteur', 'isbn', 'soort', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat']],
    ['Op de website', ['status', 'publiek', 'startpagina', 'aanrader', 'genre', 'extra_onderwerpen', 'klassieker', 'cover_url', 'beschrijving', 'beschrijving_en']],
    ['Uitlenen', ['aantal', 'uitleenbaar']]
  ];

  function toonBoeken(vak, ctx) {
    var index = Z.maakIndex(ctx.data.boeken || []);
    var zoekveld = el('input', { type: 'search', id: 'beheer-boek-zoek', autocomplete: 'off', placeholder: 'Titel, auteur, ISBN of boek-ID' });
    var lijst = el('div', { 'aria-live': 'polite' });
    function teken() {
      var q = zoekveld.value.trim();
      if (!q) { D.vervang(lijst, el('p', { class: 'hulptekst' }, 'Typ minstens een deel van een titel, auteur of ISBN.')); return; }
      var gevonden = Z.zoek(index, q).slice(0, 20).map(function (r) { return r.boek; });
      D.vervang(lijst, gevonden.length ? el('ul', { class: 'kaartlijst' }, gevonden.map(function (b) {
        return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { bewerkBoek(vak, ctx, b.id); } },
          el('strong', {}, b.t), el('span', {}, [b.a, b.id].filter(Boolean).join(' · ')),
          b.st ? el('span', { class: 'labels' }, b.st === 'verloren' ? D.statusLabel('verloren', 'Verloren') : el('span', { class: 'label label-gevoelig' }, 'Gevoelige inhoud')) : null));
      })) : el('p', {}, 'Geen boek gevonden.'));
    }
    zoekveld.addEventListener('input', teken);
    D.vervang(vak, ctx.kop('Boeken', 'Zoek een boek om het aan te passen, of voeg een nieuw boek toe. Alles komt in het tabblad Catalogus van de spreadsheet.'),
      knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { nieuwBoek(vak, ctx); } }, '+ Nieuw boek toevoegen'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonCoversZoeken(vak, ctx); } }, 'Zoek ontbrekende covers bij Google')),
      el('div', { class: 'veld' }, el('label', { for: 'beheer-boek-zoek' }, 'Zoek een boek'), zoekveld), lijst);
    teken();
  }

  /** Het formulier voor een boek. boek: bestaand boek of {} voor een nieuw. */
  function boekFormulier(vak, ctx, boek, nieuw) {
    var velden = [];
    var fout = el('div', { 'aria-live': 'assertive' });
    var delen = GROEPEN_BOEK.map(function (g) {
      return el('fieldset', { class: 'blok' }, el('legend', {}, g[0]), g[1].map(function (naam) {
        var v = veld('bb', naam, boek[naam] !== undefined ? boek[naam] : (nieuw && KEUZES[naam] ? KEUZES[naam][0][0] : ''));
        velden.push(v);
        return v.blok;
      }));
    });
    var herkomst = nieuw ? veld('bb', 'herkomst', '') : null;
    var opzoekMelding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    var opzoeken = nieuw ? el('div', { class: 'blok' },
      el('p', {}, 'Heeft het boek een ISBN? Vul het hieronder in bij ISBN en klik op ', el('strong', {}, 'Zoek gegevens op'), '. Dan vult de site titel, auteur, cover en beschrijving voor je in. Kijk alles nog even na.'),
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: zoekOp }, 'Zoek gegevens op')), opzoekMelding) : null;

    function zoekOp(e) {
      var isbn = $('bb-isbn').value;
      if (!isbn.trim()) { opzoekMelding.textContent = 'Vul eerst het ISBN in.'; $('bb-isbn').focus(); return; }
      var klaar = bezig(e.target, 'Bezig met zoeken...');
      B.voerUit('beheerIsbnOpzoeken', { isbn: isbn }).then(function (r) {
        klaar();
        if (!r.ok) { opzoekMelding.textContent = r.fout; return; }
        var ingevuld = 0;
        velden.forEach(function (v) {
          var w = r.voorstel[v.naam];
          if (w === undefined || w === '' || w === null) return;
          if (v.naam !== 'isbn' && v.lees()) return; // wat je zelf al invulde, blijft staan
          v.invoer.value = String(w);
          ingevuld++;
        });
        opzoekMelding.textContent = r.gevonden ? ingevuld + ' velden ingevuld. Kijk ze na voor je bewaart.' : 'Open Library en Google Books kennen dit ISBN niet. Vul de gegevens zelf in.';
      });
    }

    var bewaar = el('button', { type: 'submit', class: 'knop' }, nieuw ? 'Voeg toe aan de catalogus' : 'Bewaar');
    var formulier = el('form', { novalidate: true }, opzoeken, delen, herkomst ? el('fieldset', { class: 'blok' }, el('legend', {}, 'Intern'), herkomst.blok) : null,
      fout, knoppen(bewaar, el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonBoeken(vak, ctx); } }, 'Terug naar de boeken')));

    function verstuur(toch) {
      var invoer = nieuw ? { velden: gewijzigd(velden, true), herkomst: herkomst.lees(), toch: toch === true } : { boek_id: boek.boek_id, velden: gewijzigd(velden, false) };
      if (!nieuw && !Object.keys(invoer.velden).length) { B.melding(fout, 'ok', 'Er is niets veranderd.'); return; }
      var klaar = bezig(bewaar, 'Bezig met bewaren...');
      B.voerUit(nieuw ? 'beheerBoekToevoegen' : 'beheerBoekBewaren', invoer).then(function (r) {
        klaar();
        if (!r.ok) {
          D.vervang(fout, el('div', { class: 'melding fout', role: 'alert' }, el('p', {}, r.fout),
            r.dubbel ? knoppen(
              el('button', { type: 'button', class: 'knop tweede', onclick: function () { bewerkBoek(vak, ctx, r.dubbel); } }, 'Open ' + r.dubbel),
              el('button', { type: 'button', class: 'knop tweede', onclick: function () { verstuur(true); } }, 'Toch als nieuw boek toevoegen')) : null));
          return;
        }
        B.melding($('melding'), 'ok', r.tekst);
        ctx.laad();
      });
    }
    formulier.addEventListener('submit', function (e) { e.preventDefault(); verstuur(false); });

    var titel = nieuw ? 'Nieuw boek' : (boek.titel || boek.boek_id);
    D.vervang(vak, ctx.kop(titel, nieuw ? 'Velden met een waarde uit een lijst mag je zo laten.' : boek.boek_id + (boek.toegevoegd_op ? ' · toegevoegd op ' + D.korteDatum(boek.toegevoegd_op) : '')), formulier);
    vak.querySelector('h2').focus();
  }

  function bewerkBoek(vak, ctx, id) {
    D.vervang(vak, el('p', {}, 'Boek laden...'));
    B.voerUit('beheerBoekOphalen', { boek_id: id }).then(function (r) {
      if (!r.ok) { B.melding($('melding'), 'fout', r.fout); toonBoeken(vak, ctx); return; }
      boekFormulier(vak, ctx, r.boek, false);
    });
  }

  function nieuwBoek(vak, ctx) { boekFormulier(vak, ctx, {}, true); }

  /* ---------- Ontbrekende covers zoeken via deze browser ---------- */

  /*
   * Google Books weigert vragen vanuit Apps Script vaak. Vanuit een gewone browser lukt het wel.
   * Deze browser vraagt dus de covers op bij Google, en stuurt per 20 boeken door naar de
   * web-app, die ze in de Catalogus zet.
   */
  var COVERS_PER_PORTIE = 20;
  var COVERS_PAUZE_MS = 350;

  function wacht(ms) { return new Promise(function (klaar) { setTimeout(klaar, ms); }); }

  /** Vraagt één ISBN op bij Google Books. Geeft { info } of { fout, limiet, storing }. */
  function vraagGoogle(isbn, sleutel) {
    var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn) + (sleutel ? '&key=' + encodeURIComponent(sleutel) : '');
    return fetch(url).then(function (r) { return r.json().then(function (d) { return { code: r.status, d: d }; }); }).then(function (a) {
      if (a.code >= 400 || a.d.error) {
        var fout = (a.d.error && a.d.error.message) || ('code ' + a.code);
        return { fout: fout, limiet: a.code === 429 || /quota|limit/i.test(fout), storing: a.code >= 500 };
      }
      var item = (a.d.items || [])[0];
      return { info: item ? item.volumeInfo : null };
    }, function () { return { fout: 'Geen verbinding met Google.', storing: true }; });
  }

  function toonCoversZoeken(vak, ctx) {
    var stop = false;
    var voortgang = el('progress', { max: '1', value: '0', style: 'width:100%' });
    var status = el('p', { 'aria-live': 'polite' }, 'Lijst ophalen...');
    var stopKnop = el('button', { type: 'button', class: 'knop tweede', onclick: function () { stop = true; stopKnop.disabled = true; status.textContent = 'Stoppen na deze portie...'; } }, 'Stop');
    D.vervang(vak, ctx.kop('Ontbrekende covers zoeken', 'Deze browser vraagt bij Google Books een cover voor elk boek met een ISBN zonder cover. Wat gevonden wordt, komt meteen in de Catalogus. Laat dit venster open tot het klaar is. Je kan altijd stoppen en later verdergaan.'),
      voortgang, status, knoppen(stopKnop, el('button', { type: 'button', class: 'knop tweede', onclick: function () { stop = true; toonBoeken(vak, ctx); } }, 'Terug naar de boeken')));

    B.voerUit('beheerCoversLijst').then(function (r) {
      if (!r.ok) { status.textContent = r.fout || 'De lijst laden lukte niet.'; return; }
      var boeken = r.boeken, sleutel = r.sleutel;
      if (!boeken.length) { status.textContent = 'Alle boeken met een ISBN hebben een cover, of werden al bij Google opgezocht.'; stopKnop.hidden = true; return; }
      if (!sleutel) { status.textContent = 'Let op: er staat geen google_books_api_key in Instellingen. Zonder sleutel stopt Google snel.'; }
      voortgang.max = boeken.length;
      var gedaan = 0, covers = 0, gezocht = [], resultaten = [];

      function stuur() {
        if (!gezocht.length) return Promise.resolve({ ok: true });
        var pakket = { gezocht: gezocht, resultaten: resultaten };
        gezocht = []; resultaten = [];
        return B.voerUit('beheerCoversBewaren', pakket).then(function (a) { if (a.ok) covers += a.covers; return a; });
      }

      function toon(tekst) {
        voortgang.value = gedaan;
        status.textContent = gedaan + ' van ' + boeken.length + ' opgezocht, ' + covers + ' covers gevonden.' + (tekst ? ' ' + tekst : '');
      }

      function volgende(i) {
        if (stop || i >= boeken.length) {
          return stuur().then(function () { toon(stop ? 'Gestopt. Klik later opnieuw om verder te gaan.' : 'Klaar.'); stopKnop.hidden = true; });
        }
        var b = boeken[i];
        return vraagGoogle(b.isbn, sleutel).then(function (a) {
          if (a.storing && !a.info) return wacht(3000).then(function () { return vraagGoogle(b.isbn, sleutel); });
          return a;
        }).then(function (a) {
          if (a.fout) {
            // Daglimiet of iets anders: stoppen, en niets aanvinken voor dit boek.
            return stuur().then(function () { toon('Google meldt: ' + a.fout + (a.limiet ? ' Probeer het morgen opnieuw.' : '')); stopKnop.hidden = true; });
          }
          gezocht.push(b.id);
          if (a.info) {
            var v = a.info, links = v.imageLinks || {};
            resultaten.push({ boek_id: b.id, cover: links.thumbnail || links.smallThumbnail || '', beschrijving: v.description || '',
              uitgeverij: v.publisher || '', jaartal: v.publishedDate || '', paginas: v.pageCount || '', taal: v.language || '' });
          }
          gedaan++;
          var bewaar = gezocht.length >= COVERS_PER_PORTIE ? stuur() : Promise.resolve({ ok: true });
          return bewaar.then(function (s) {
            if (!s.ok) { toon('Bewaren lukte niet: ' + (s.fout || '') + ' Gestopt.'); stopKnop.hidden = true; return; }
            toon('');
            return wacht(COVERS_PAUZE_MS).then(function () { return volgende(i + 1); });
          });
        });
      }
      toon('');
      volgende(0);
    });
  }

  /** Zet een knop op "bezig". Geeft een functie terug om ze terug te zetten. */
  function bezig(knop, tekst) {
    var oud = knop.textContent;
    knop.disabled = true;
    knop.textContent = tekst;
    return function () { knop.disabled = false; knop.textContent = oud; };
  }

  /* ---------- Nieuws, agenda en vragen ---------- */

  var inhoud = null; // gegevens uit beheerInhoud, tot iemand op Vernieuw klikt

  var INHOUD = [
    ['Nieuws', 'Nieuws', ['datum', 'titel', 'tekst', 'titel_en', 'tekst_en', 'afbeelding', 'link', 'publiek'], 'Nieuw bericht'],
    ['Agenda', 'Agenda', ['datum', 'uur', 'titel', 'tekst', 'locatie', 'titel_en', 'tekst_en', 'afbeelding', 'link', 'publiek'], 'Nieuw event'],
    ['Veelgestelde vragen', 'Veelgestelde vragen', ['volgorde', 'vraag', 'antwoord', 'vraag_en', 'antwoord_en', 'publiek'], 'Nieuwe vraag']
  ];
  var gekozenInhoud = 'Nieuws';

  function laadInhoud(vak, ctx, verder) {
    if (inhoud) { verder(); return; }
    D.vervang(vak, el('p', {}, 'Laden...'));
    B.voerUit('beheerInhoud').then(function (r) {
      if (!r.ok) { B.melding($('melding'), 'fout', r.fout || 'Laden lukte niet.'); return; }
      inhoud = r.data;
      verder();
    });
  }

  function toonInhoud(vak, ctx) {
    laadInhoud(vak, ctx, function () {
      var soort = INHOUD.filter(function (s) { return s[0] === gekozenInhoud; })[0];
      var rijen = (inhoud.tabbladen[soort[0]] || []).slice();
      if (soort[0] === 'Veelgestelde vragen') rijen.sort(function (a, b) { return (Number(a.volgorde) || 999) - (Number(b.volgorde) || 999); });
      else rijen.sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });
      var tabs = el('div', { class: 'knoppen', role: 'group', 'aria-label': 'Kies wat je wil aanpassen' }, INHOUD.map(function (s) {
        return el('button', {
          type: 'button', class: 'knop' + (s[0] === gekozenInhoud ? '' : ' tweede'), 'aria-pressed': s[0] === gekozenInhoud ? 'true' : 'false',
          onclick: function () { gekozenInhoud = s[0]; toonInhoud(vak, ctx); }
        }, s[1]);
      }));
      D.vervang(vak, ctx.kop('Nieuws en agenda', 'Berichten, events en veelgestelde vragen op de startpagina. Alles komt in het gelijknamige tabblad van de spreadsheet.'),
        tabs,
        knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { inhoudFormulier(vak, ctx, soort, null); } }, '+ ' + soort[3])),
        rijen.length ? el('ul', { class: 'kaartlijst' }, rijen.map(function (r) {
          var hoofd = r.titel || r.vraag || '(zonder titel)';
          var sub = soort[0] === 'Veelgestelde vragen' ? (r.volgorde ? 'Volgorde ' + r.volgorde : '') : [D.korteDatum(r.datum), r.uur, r.locatie].filter(Boolean).join(' · ');
          return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { inhoudFormulier(vak, ctx, soort, r); } },
            el('strong', {}, hoofd), sub ? el('span', {}, sub) : null,
            r.publiek === 'nee' ? el('span', { class: 'labels' }, D.statusLabel('niet_uitleenbaar', 'Verborgen')) : null));
        })) : el('p', {}, 'Hier staat nog niets.'));
    });
  }

  function inhoudFormulier(vak, ctx, soort, rij) {
    var velden = soort[2].map(function (naam) {
      var w = rij ? rij[naam] : (naam === 'publiek' ? 'ja' : '');
      return veld('bi', naam, w);
    });
    var fout = el('div', { 'aria-live': 'assertive' });
    var bewaar = el('button', { type: 'submit', class: 'knop' }, rij ? 'Bewaar' : 'Voeg toe');
    var verwijder = rij ? el('button', { type: 'button', class: 'knop tweede', onclick: function () {
      if (!window.confirm('Wil je dit echt verwijderen? Wil je het enkel even weghalen van de website, zet dan "Op de website" op Nee.')) return;
      stuur({ tabblad: soort[0], rij: rij.rij, vingerafdruk: rij.vingerafdruk, verwijderen: true }, verwijder);
    } }, 'Verwijder') : null;
    var formulier = el('form', { novalidate: true }, velden.map(function (v) { return v.blok; }), fout,
      knoppen(bewaar, el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonInhoud(vak, ctx); } }, 'Terug'), verwijder));

    function stuur(invoer, knop) {
      var klaar = bezig(knop, 'Bezig...');
      B.voerUit('beheerInhoudBewaren', invoer).then(function (r) {
        klaar();
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        B.melding($('melding'), 'ok', r.tekst + ' De website toont het binnen enkele minuten.');
        inhoud = null;
        toonInhoud(vak, ctx);
      });
    }
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = gewijzigd(velden, !rij);
      if (rij && !Object.keys(v).length) { B.melding(fout, 'ok', 'Er is niets veranderd.'); return; }
      stuur({ tabblad: soort[0], rij: rij ? rij.rij : null, vingerafdruk: rij ? rij.vingerafdruk : null, velden: v }, bewaar);
    });
    D.vervang(vak, ctx.kop(rij ? (rij.titel || rij.vraag || soort[1]) : soort[3]), formulier);
    vak.querySelector('h2').focus();
  }

  /* ---------- Teksten en instellingen ---------- */

  function toonInstellingen(vak, ctx) {
    laadInhoud(vak, ctx, function () {
      var groepen = inhoud.instellingen.map(function (g) {
        return el('section', { class: 'blok' }, el('h3', {}, g.titel), g.instellingen.map(instellingVeld));
      });
      D.vervang(vak, ctx.kop('Teksten en instellingen', 'Pas een waarde aan en klik op Bewaar naast die instelling. De codes pas je enkel in de spreadsheet aan.'), groepen);
    });
  }

  function instellingVeld(inst) {
    var id = 'inst-' + inst.sleutel;
    var lang = inst.waarde.length > 60 || /^tekst_|openingsuren/.test(inst.sleutel);
    var invoer = lang ? el('textarea', { id: id, rows: '4' }) : el('input', { type: 'text', id: id, value: inst.waarde, autocomplete: 'off' });
    if (lang) invoer.value = inst.waarde;
    if (inst.uitleg) invoer.setAttribute('aria-describedby', id + '-uitleg');
    var knop = el('button', { type: 'button', class: 'knop tweede', disabled: true }, 'Bewaar');
    var melding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    invoer.addEventListener('input', function () { knop.disabled = invoer.value === inst.waarde; melding.textContent = ''; });
    knop.addEventListener('click', function () {
      var klaar = bezig(knop, 'Bezig...');
      B.voerUit('beheerInstellingBewaren', { sleutel: inst.sleutel, waarde: invoer.value }).then(function (r) {
        klaar();
        if (!r.ok) { melding.textContent = r.fout; knop.disabled = false; return; }
        inst.waarde = invoer.value;
        knop.disabled = true;
        melding.textContent = 'Bewaard.';
      });
    });
    return el('div', { class: 'veld' },
      el('label', { for: id }, inst.sleutel),
      inst.uitleg ? el('p', { class: 'hulptekst', id: id + '-uitleg' }, inst.uitleg) : null,
      invoer, el('div', { class: 'knoppen' }, knop), melding);
  }

  root.MadrigalBestuurBeheer = {
    boeken: toonBoeken,
    inhoud: toonInhoud,
    instellingen: toonInstellingen,
    /** Bij Vernieuw: nieuws, agenda en instellingen opnieuw ophalen. */
    vergeet: function () { inhoud = null; }
  };
})(window);
