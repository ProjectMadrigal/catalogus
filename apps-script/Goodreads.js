/**
 * Goodreads.js
 * Vult lege velden in de Catalogus aan met de export van de Goodreads-shelf.
 *
 * Werkwijze:
 *   1. Koppeling op ISBN: zeker. Lege velden worden aangevuld.
 *   2. Anders koppeling op titel en achternaam van de auteur: ook aangevuld.
 *   3. Enkel de titel komt overeen: twijfel, dat gaat naar "Na te kijken".
 *   4. Staat er al een andere waarde in de Catalogus: die blijft staan,
 *      en beide waarden komen naast elkaar in "Na te kijken".
 *
 * De export van Goodreads bevat geen taal en geen beschrijving. Die vult
 * Open Library later aan.
 */

/** Welke kolom van de Goodreads-export welk veld van de Catalogus aanvult. */
var GOODREADS_VELDEN = {
  uitgeverij: ['Publisher'],
  jaartal: ['Year Published', 'Original Publication Year'],
  paginas: ['Number of Pages']
};

/** Goodreads zet ISBN's als ="0123456789". Dit haalt die tekens weg. */
function goodreadsIsbn(waarde) {
  return normaliseerIsbn(String(waarde || '').replace(/[="]/g, '')).isbn;
}

/** Zet de ruwe waarden van het tabblad Goodreads-export om naar objecten. */
function leesGoodreadsRijen(waarden) {
  if (!waarden.length) return [];
  var kop = waarden[0].map(schoon);
  return waarden.slice(1).map(function (rij) {
    var obj = {};
    kop.forEach(function (k, i) { if (k) obj[k] = rij[i]; });
    return obj;
  }).filter(function (o) { return !isLeeg(o.Title); });
}

/** De eerste niet-lege waarde uit een lijst Goodreads-kolommen. */
function goodreadsWaarde(rij, kolommen) {
  for (var i = 0; i < kolommen.length; i++) {
    var w = rij[kolommen[i]];
    if (!isLeeg(w) && String(w).trim() !== '0') return w;
  }
  return '';
}

/** Zijn twee waarden in feite dezelfde? (hoofdletters, leestekens en getalnotatie tellen niet) */
function zelfdeWaarde(a, b) {
  var na = parseerGetal(a), nb = parseerGetal(b);
  if (typeof a === 'number' || typeof b === 'number') return na === nb;
  return normaliseerTekst(a) === normaliseerTekst(b);
}

/**
 * Koppelt de Catalogus aan de Goodreads-export (zonder de spreadsheet aan te raken).
 * catalogus: rijen van de Catalogus
 * goodreads: rijen uit leesGoodreadsRijen
 * Geeft terug:
 *   aanvullingen: [{ boek, veld, waarde }]   -> mag meteen ingevuld worden
 *   naTeKijken:   [{ boek, veld, waarde_catalogus, waarde_bron, opmerking }]
 */
function koppelGoodreads(catalogus, goodreads) {
  var opIsbn = {}, opTitelAuteur = {}, opTitel = {};
  goodreads.forEach(function (g) {
    [goodreadsIsbn(g.ISBN13), goodreadsIsbn(g.ISBN)].forEach(function (i) { if (i) opIsbn[i] = g; });
    var auteur = g['Author l-f'] || g.Author;
    var t = titelSleutel(g.Title);
    opTitelAuteur[t + '|' + achternaam(auteur)] = g;
    (opTitel[t] = opTitel[t] || []).push(g);
  });

  var aanvullingen = [], naTeKijken = [];
  catalogus.forEach(function (boek) {
    if (isLeeg(boek.boek_id)) return;
    var t = titelSleutel(boek.titel);
    var g = boek.isbn ? opIsbn[boek.isbn] : null;
    var manier = 'isbn';
    if (!g) { g = opTitelAuteur[t + '|' + achternaam(boek.auteur)]; manier = 'titel en auteur'; }
    if (!g && opTitel[t] && opTitel[t].length === 1) {
      // Twijfel: enkel de titel komt overeen. Niets invullen, wel voorleggen.
      var kandidaat = opTitel[t][0];
      naTeKijken.push({
        boek: boek, veld: 'koppeling', waarde_catalogus: boek.auteur,
        waarde_bron: kandidaat.Title + ' / ' + (kandidaat.Author || ''),
        opmerking: 'Enkel de titel komt overeen, de auteur verschilt. Is dit hetzelfde boek? Vul dan zelf aan.'
      });
      return;
    }
    if (!g) return;

    Object.keys(GOODREADS_VELDEN).forEach(function (veld) {
      var waarde = goodreadsWaarde(g, GOODREADS_VELDEN[veld]);
      if (isLeeg(waarde)) return;
      if (veld !== 'uitgeverij') waarde = parseerGetal(waarde) || '';
      if (isLeeg(waarde)) return;
      if (isLeeg(boek[veld])) {
        aanvullingen.push({ boek: boek, veld: veld, waarde: veld === 'uitgeverij' ? schoon(waarde) : waarde });
      } else if (!zelfdeWaarde(boek[veld], waarde)) {
        naTeKijken.push({
          boek: boek, veld: veld, waarde_catalogus: boek[veld], waarde_bron: waarde,
          opmerking: 'Gekoppeld op ' + manier + '. De Catalogus heeft een andere waarde. Die blijft staan, tenzij je ze zelf aanpast.'
        });
      }
    });
    // Een ISBN vullen we nooit zelf in: het kan van een andere uitgave zijn.
    var grIsbn = goodreadsIsbn(g.ISBN13) || goodreadsIsbn(g.ISBN);
    if (!boek.isbn && grIsbn) {
      naTeKijken.push({
        boek: boek, veld: 'isbn', waarde_catalogus: '', waarde_bron: grIsbn,
        opmerking: 'ISBN uit Goodreads. Klopt het met jouw uitgave? Zet het dan in de Catalogus, zodat Open Library de cover kan vinden.'
      });
    }
  });
  return { aanvullingen: aanvullingen, naTeKijken: naTeKijken };
}

/**
 * Voegt twijfelgevallen toe aan het tabblad "Na te kijken", zonder dubbels.
 * rijen: rijen van "Na te kijken"; items: [{boek, veld, waarde_catalogus, waarde_bron, opmerking}]
 */
function voegNaTeKijkenToe(rijen, items, bron, vandaag) {
  var bekend = {};
  rijen.forEach(function (r) { bekend[r.sleutel] = true; });
  var nieuw = 0;
  items.forEach(function (item) {
    var sleutel = bron + '|' + (item.boek ? item.boek.boek_id : item.boek_id) + '|' + item.veld + '|' + normaliseerTekst(item.waarde_bron);
    if (bekend[sleutel]) return;
    bekend[sleutel] = true;
    voegToe(rijen, {
      datum: vandaag, bron: bron,
      boek_id: item.boek ? item.boek.boek_id : (item.boek_id || ''),
      titel: item.boek ? item.boek.titel : (item.titel || ''),
      veld: item.veld, waarde_catalogus: item.waarde_catalogus, waarde_bron: item.waarde_bron,
      opmerking: item.opmerking, afgehandeld: 'nee', sleutel: sleutel
    });
    nieuw++;
  });
  return nieuw;
}

/** Menu: vult de Catalogus aan uit het tabblad Goodreads-export. */
function vulAanUitGoodreads(stil) {
  var blad = spreadsheet().getSheetByName('Goodreads-export');
  if (!blad) {
    meld('Er is geen tabblad "Goodreads-export". Plak eerst de export van Goodreads in een nieuw tabblad met die naam.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var goodreads = leesGoodreadsRijen(blad.getDataRange().getValues());
    var catalogus = leesTabel('Catalogus');
    var naTeKijken = leesTabel('Na te kijken');
    var resultaat = koppelGoodreads(catalogus.rijen, goodreads);
    resultaat.aanvullingen.forEach(function (a) {
      var v = {}; v[a.veld] = a.waarde;
      wijzig(a.boek, v);
    });
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken, 'Goodreads', vandaagTekst());
    bewaarTabel(catalogus);
    bewaarTabel(naTeKijken);
    leegCache();
    logboek('menu', 'vulAanUitGoodreads', resultaat.aanvullingen.length + ' velden aangevuld, ' + nieuw + ' na te kijken');
    if (!stil) meld(resultaat.aanvullingen.length + ' velden aangevuld uit Goodreads. ' + nieuw + ' nieuwe twijfelgevallen in "Na te kijken".');
  } finally {
    lock.releaseLock();
  }
}
