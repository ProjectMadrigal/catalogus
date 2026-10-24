/**
 * filters.js
 * De filters en het sorteren van de catalogus, volledig in de browser.
 * Een filter toevoegen? Voeg een blok toe aan FILTERS met:
 *   sleutel:  korte naam, komt ook in de link (bv. ?taal=Engels)
 *   label:    tekst boven het keuzemenu (labelSleutel: de vertaling in i18n.js)
 *   waarden:  functie(boek) die de waarde(n) van dat boek als lijst teruggeeft
 *   volgorde: (optioneel) functie die de keuzes sorteert
 */
(function (root) {
  'use strict';

  /** Periodes van uitgave. */
  var PERIODES = [
    { label: 'Voor 1970', van: 0, tot: 1969 },
    { label: '1970 tot 1989', van: 1970, tot: 1989 },
    { label: '1990 tot 1999', van: 1990, tot: 1999 },
    { label: '2000 tot 2009', van: 2000, tot: 2009 },
    { label: '2010 tot 2019', van: 2010, tot: 2019 },
    { label: '2020 en later', van: 2020, tot: 9999 }
  ];

  function periodeVan(jaar) {
    var j = Number(jaar);
    if (!j) return '';
    for (var i = 0; i < PERIODES.length; i++) {
      if (j >= PERIODES[i].van && j <= PERIODES[i].tot) return PERIODES[i].label;
    }
    return '';
  }

  function alfabetisch(a, b) { return a.localeCompare(b, 'nl'); }

  var FILTERS = [
    { sleutel: 'groep', labelSleutel: 'fOnderwerp', label: 'Onderwerp', waarden: function (b) { return b.g || []; } /* volgorde: zie catalogus */ },
    { sleutel: 'taal', labelSleutel: 'fTaal', label: 'Taal', waarden: function (b) { return b.l ? [b.l] : []; }, volgorde: alfabetisch },
    { sleutel: 'staat', labelSleutel: 'fStaat', label: 'Nieuw of tweedehands', waarden: function (b) { return b.n ? [b.n === 'nieuw' ? 'Nieuw' : 'Tweedehands'] : []; }, volgorde: alfabetisch },
    { sleutel: 'uitvoering', labelSleutel: 'fUitvoering', label: 'Uitvoering', waarden: function (b) { return b.v ? [b.v] : []; }, volgorde: alfabetisch },
    {
      sleutel: 'periode', labelSleutel: 'fPeriode', label: 'Periode van uitgave',
      waarden: function (b) { var p = periodeVan(b.j); return p ? [p] : []; },
      volgorde: function (a, b) {
        var labels = PERIODES.map(function (p) { return p.label; });
        return labels.indexOf(a) - labels.indexOf(b);
      }
    },
    { sleutel: 'aanrader', labelSleutel: 'fAanrader', label: 'Aanrader', waarden: function (b) { return (b.r || []).map(function (n) { return 'Aanrader van ' + n; }); }, volgorde: alfabetisch }
  ];

  /**
   * De keuzes per filter, met het aantal boeken.
   * groepVolgorde: de volgorde van de filtergroepen uit de catalogus.
   * Geeft { sleutel: [{ waarde, aantal }] } terug.
   */
  function opties(boeken, groepVolgorde) {
    var resultaat = {};
    FILTERS.forEach(function (f) {
      var tel = {};
      boeken.forEach(function (b) { f.waarden(b).forEach(function (w) { tel[w] = (tel[w] || 0) + 1; }); });
      var lijst = Object.keys(tel);
      if (f.sleutel === 'groep' && groepVolgorde) {
        lijst.sort(function (a, b) {
          var ia = groepVolgorde.indexOf(a), ib = groepVolgorde.indexOf(b);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || alfabetisch(a, b);
        });
      } else if (f.volgorde) {
        lijst.sort(f.volgorde);
      }
      resultaat[f.sleutel] = lijst.map(function (w) { return { waarde: w, aantal: tel[w] }; });
    });
    return resultaat;
  }

  /**
   * Past de gekozen filters toe.
   * keuzes: { groep: 'Gender', taal: 'Engels', ..., beschikbaar: true }
   */
  function pasToe(boeken, keuzes) {
    return boeken.filter(function (b) {
      for (var i = 0; i < FILTERS.length; i++) {
        var f = FILTERS[i];
        var gekozen = keuzes[f.sleutel];
        if (gekozen && f.waarden(b).indexOf(gekozen) === -1) return false;
      }
      if (keuzes.beschikbaar && (!b.b || b.b.c !== 'beschikbaar')) return false;
      return true;
    });
  }

  /**
   * Sorteert een lijst boeken.
   * wijze: 'titel', 'auteur', 'jaar-nieuw', 'jaar-oud', 'toegevoegd' of 'relevantie' (lijst blijft zoals ze is).
   * toegevoegd: de datum van toevoegen (ta), anders het hoogste boek-ID eerst.
   */
  function sorteer(boeken, wijze) {
    var Z = root.MadrigalZoeken;
    var lijst = boeken.slice();
    var opTitel = function (a, b) { return Z.sorteerTekst(a.t).localeCompare(Z.sorteerTekst(b.t), 'nl'); };
    if (wijze === 'titel') lijst.sort(opTitel);
    else if (wijze === 'auteur') {
      lijst.sort(function (a, b) {
        // Boeken zonder auteur achteraan.
        if (!a.a !== !b.a) return a.a ? -1 : 1;
        return Z.normaliseer(a.a).localeCompare(Z.normaliseer(b.a), 'nl') || opTitel(a, b);
      });
    } else if (wijze === 'toegevoegd') {
      var nr = function (b) { return Number(String(b.id).replace(/\D/g, '')) || 0; };
      lijst.sort(function (a, b) { return String(b.ta || '').localeCompare(String(a.ta || '')) || nr(b) - nr(a); });
    } else if (wijze === 'jaar-nieuw' || wijze === 'jaar-oud') {
      var richting = wijze === 'jaar-nieuw' ? -1 : 1;
      lijst.sort(function (a, b) {
        // Boeken zonder jaartal achteraan.
        if (!a.j !== !b.j) return a.j ? -1 : 1;
        return richting * ((a.j || 0) - (b.j || 0)) || opTitel(a, b);
      });
    }
    return lijst;
  }

  var api = { FILTERS: FILTERS, PERIODES: PERIODES, periodeVan: periodeVan, opties: opties, pasToe: pasToe, sorteer: sorteer };
  root.MadrigalFilters = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
