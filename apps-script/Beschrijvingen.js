/**
 * Beschrijvingen.js
 * Zoekt een korte beschrijving voor boeken waar de kolom beschrijving nog leeg is.
 *
 *   1. Google Books (op ISBN). Heeft vaak een flaptekst, soms in de taal van het boek.
 *   2. Lukt dat niet: Open Library. De beschrijving staat daar bij het "werk",
 *      niet bij de uitgave. Daarom zoeken we eerst de uitgave op en dan het werk.
 *
 *   - Goodreads geeft geen beschrijvingen: niet in de export, en Goodreads heeft
 *     geen open API meer. Daarom gebruiken we die bron hier niet.
 *   - Enkel boeken met een ISBN. Zines en boeken zonder ISBN vul je zelf in.
 *   - Een beschrijving die je zelf invult, overschrijft het script nooit.
 *   - Elk opgezocht boek krijgt een datum in de kolom beschrijving_gezocht.
 *     Opnieuw laten zoeken? Maak die cel leeg.
 *   - Zonder API-sleutel (instelling google_books_api_key) deelt Google een kleine
 *     daglimiet met veel andere gebruikers. Is die op, dan zoekt het script verder
 *     bij Open Library en probeert het Google over 6 uur opnieuw.
 *   - Werkt in porties van 4,5 minuten en plant zichzelf opnieuw in, net als
 *     Open Library en Google Books. Google Books start dit vanzelf als het klaar is.
 */

var BS_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;
var BS_MAX_LENGTE = 1000;
var BS_USER_AGENT = 'ProjectMadrigal-catalogus (Google Apps Script; queer bibliotheek Antwerpen)';

/** Moet het script voor dit boek nog een beschrijving zoeken? */
function heeftBeschrijvingNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.beschrijving_gezocht)) return false;
  return isLeeg(boek.beschrijving);
}

/**
 * Maakt een beschrijving uit een externe bron netjes: geen HTML, geen
 * bronvermeldingen van Open Library, en hoogstens BS_MAX_LENGTE tekens.
 * Alinea's blijven behouden.
 */
function maakBeschrijvingNetjes(tekst) {
  var t = String(tekst || '');
  // Open Library zet onder een streep vaak bronnen en links: die laten we weg.
  t = t.split(/\n\s*-{3,}/)[0];
  t = t
    .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')       // [tekst](link) wordt tekst
    .replace(/\[([^\]]+)\]\[\d+\]/g, '$1')         // [tekst][1] wordt tekst
    .replace(/^\s*\[\d+\]:.*$/gm, '')              // [1]: https://... weg
    .replace(/\(\s*\[?source\]?[^)]*\)/gi, '')     // (source) weg
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (t.length > BS_MAX_LENGTE) t = t.slice(0, BS_MAX_LENGTE - 3).replace(/\s+\S*$/, '') + '...';
  return t;
}

/** Een beschrijving uit Open Library: tekst, of een object met value. */
function olTekst(description) {
  if (!description) return '';
  return typeof description === 'string' ? description : String(description.value || '');
}

/** Haalt JSON op. Geeft { code, data } terug. */
function haalJson(url) {
  var antwoord = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT } });
  var data = null;
  try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = null; }
  return { code: antwoord.getResponseCode(), data: data };
}

/** Beschrijving via Google Books. Geeft { tekst } of { limiet: true }. */
function beschrijvingUitGoogleBooks(isbn, sleutel) {
  var r = haalJson('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn + (sleutel ? '&key=' + encodeURIComponent(sleutel) : ''));
  if (r.code === 429 || r.code === 403) return { limiet: true };
  var items = (r.data && r.data.items) || [];
  for (var i = 0; i < items.length; i++) {
    var tekst = maakBeschrijvingNetjes(items[i].volumeInfo && items[i].volumeInfo.description);
    if (tekst) return { tekst: tekst };
  }
  return { tekst: '' };
}

/** Beschrijving via Open Library: eerst de uitgave, dan het werk. */
function beschrijvingUitOpenLibrary(isbn) {
  var uitgave = haalJson('https://openlibrary.org/isbn/' + isbn + '.json');
  if (uitgave.code === 429) return { limiet: true };
  if (!uitgave.data) return { tekst: '' };
  var tekst = maakBeschrijvingNetjes(olTekst(uitgave.data.description));
  if (tekst) return { tekst: tekst };
  var werk = uitgave.data.works && uitgave.data.works.length ? uitgave.data.works[0].key : '';
  if (!/^\/works\/OL\d+W$/.test(String(werk))) return { tekst: '' };
  Utilities.sleep(1000);
  var w = haalJson('https://openlibrary.org' + werk + '.json');
  if (w.code === 429) return { limiet: true };
  return { tekst: maakBeschrijvingNetjes(olTekst(w.data && w.data.description)) };
}

/** Menu: zoekt beschrijvingen voor boeken waar die nog ontbreekt, in porties. */
function vulBeschrijvingenAan() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.');
    return;
  }
  var verwerkt = 0, gevonden = 0, rest = 0, limiet = false, gbLimiet = false;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('beschrijving_gezocht') === -1) {
      meld('De kolom beschrijving_gezocht ontbreekt nog in de Catalogus. Voer eerst "installeer" uit.');
      return;
    }
    var sleutel = leesInstellingen().google_books_api_key;
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftBeschrijvingNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BS_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      // Zit Google aan zijn daglimiet, dan zoeken we verder bij Open Library alleen.
      var r = gbLimiet ? { tekst: '' } : beschrijvingUitGoogleBooks(boek.isbn, sleutel);
      if (r.limiet) { gbLimiet = true; limiet = true; r = { tekst: '' }; }
      if (!r.tekst) { Utilities.sleep(1000); r = beschrijvingUitOpenLibrary(boek.isbn); }
      if (r.limiet) break; // Open Library vraagt om te wachten
      if (r.tekst) {
        wijzig(boek, { beschrijving: r.tekst, beschrijving_gezocht: vandaag });
        gevonden++;
      } else if (!gbLimiet) {
        wijzig(boek, { beschrijving_gezocht: vandaag });
      } // anders niet afvinken: Google probeert het later opnieuw
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarTabel(tabel);
      Utilities.sleep(400);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftBeschrijvingNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('vulBeschrijvingenAan');
  if (rest > 0) {
    // Bij een limiet wachten we een paar uur, anders een minuut.
    ScriptApp.newTrigger('vulBeschrijvingenAan').timeBased().after((limiet ? 6 * 60 : 1) * 60 * 1000).create();
  }
  if (gevonden) leegCache();
  logboek('menu', 'vulBeschrijvingenAan', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden, ' + rest + ' te gaan' + (limiet ? ' (limiet bereikt)' : ''));
  var tekst = verwerkt + ' boeken opgezocht, ' + gevonden + ' beschrijvingen gevonden.';
  if (rest > 0) tekst += limiet ? ' De daglimiet is bereikt: over 6 uur gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}
