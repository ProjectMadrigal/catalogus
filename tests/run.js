/**
 * Tests voor de catalogus en het uitleensysteem.
 * Uitvoeren:  node tests/run.js
 * Alle namen, boeken en gegevens hieronder zijn verzonnen.
 */
'use strict';

const assert = require('assert');
const { laad } = require('./laad');

const M = laad();
let geslaagd = 0;
const mislukt = [];

/** Vergelijkt waarden als JSON (lijsten uit de testomgeving hebben een ander prototype). */
function gelijk(a, b) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
}

function test(naam, fn) {
  try {
    fn();
    geslaagd++;
    console.log('  ok   ' + naam);
  } catch (e) {
    mislukt.push(naam);
    console.log('  FOUT ' + naam + '\n       ' + (e && e.message));
  }
}

/** Instellingen zoals de standaard, met aanpassingen. */
function instellingen(ruw) {
  return M.verwerkInstellingen(ruw || {});
}

/** Een verzonnen staat met een kleine catalogus en drie leners. */
function maakStaat(vandaag, ruw) {
  return {
    inst: instellingen(ruw),
    vandaag: vandaag || '2026-10-23',
    wie: 'Testvrijwilliger',
    catalogus: [
      { boek_id: 'B0001', soort: 'boek', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', isbn: '9780306406157', aantal: 1, uitleenbaar: 'ja', publiek: 'ja', genre: 'Roman', herkomst: 'gift van Kees Voorbeeld' },
      { boek_id: 'B0002', soort: 'boek', titel: 'Twee kasten vol', auteur: 'Dewit, Rein', isbn: '', aantal: 2, uitleenbaar: 'ja', publiek: 'ja', genre: 'essay' },
      { boek_id: 'B0003', soort: 'boek', titel: 'Stille lichten', auteur: 'Aerts, Noor', isbn: '', aantal: '', uitleenbaar: 'ja', publiek: 'ja', genre: 'Poëzie' },
      { boek_id: 'B0004', soort: 'boek', titel: 'Het nachtboek', auteur: 'Claes, Ilo', isbn: '', aantal: 1, uitleenbaar: 'ja', publiek: 'nee', genre: 'Roman', herkomst: 'niet op site' },
      { boek_id: 'Z0001', soort: 'zine', titel: 'Glitterbrief #3', auteur: 'Collectief Fictief', isbn: '', aantal: 1, uitleenbaar: 'nee', publiek: 'ja', genre: 'verkoop' }
    ],
    leners: [
      { lenersnummer: '1', voornaam: 'Sam', achternaam: 'Achternaamtest', telefoon: '0470 00 00 01', email: 'sam@voorbeeld.test', datum_inschrijving: '2026-01-10', toestemming_privacy: 'ja', actief: 'ja' },
      { lenersnummer: '2', voornaam: 'Jo', achternaam: '', telefoon: '', email: 'jo@voorbeeld.test', datum_inschrijving: '2026-02-01', toestemming_privacy: 'ja', actief: 'ja' },
      { lenersnummer: '3', voornaam: 'Alex', achternaam: '', telefoon: '0470 00 00 03', email: '', datum_inschrijving: '2026-03-01', toestemming_privacy: 'ja', actief: 'ja' }
    ],
    uitleningen: [],
    reservaties: [],
    uitzonderingen: [],
    uitzonderingenTabel: [],
    log: []
  };
}

function uitleen(staat, exemplaar, lener, extra) {
  return M.uitlenen(staat, Object.assign({ exemplaar: exemplaar, lenersnummer: lener, borg: 5, betaalwijze: 'cash', gift: '' }, extra || {}));
}

console.log('\nISBN');

test('ISBN-10 met streepjes wordt ISBN-13', () => {
  const r = M.normaliseerIsbn('0-306-40615-2');
  assert.strictEqual(r.isbn, '9780306406157');
  assert.strictEqual(r.geldig, true);
});
test('ISBN-10 met X als controlecijfer', () => {
  assert.strictEqual(M.normaliseerIsbn('080442957X').isbn, '9780804429573');
});
test('ISBN-13 met spaties', () => {
  assert.strictEqual(M.normaliseerIsbn(' 978 0 306 40615 7 ').isbn, '9780306406157');
});
test('ISBN als getal uit de spreadsheet', () => {
  assert.strictEqual(M.normaliseerIsbn(9780306406157).isbn, '9780306406157');
});
test('fout controlecijfer wordt geweigerd', () => {
  const r = M.normaliseerIsbn('978-0-306-40615-8');
  assert.strictEqual(r.isbn, '');
  assert.strictEqual(r.geldig, false);
});
test('ISSN van een zine', () => {
  assert.strictEqual(M.normaliseerIsbn('ISSN 1234-5679').issn, '1234-5679');
});
test('leeg ISBN', () => {
  assert.strictEqual(M.normaliseerIsbn('').leeg, true);
});

console.log('\nOpschonen van de stocklijst');

test('Stock: kolom A genegeerd, lege rijen en herhaalde kop overgeslagen, herkomst apart', () => {
  const waarden = [
    ['', 'Titel', 'Auteur(s)', 'ISBN', 'Uitgeverij', 'Jaartal', 'Taal', "Pagina's", 'Uitvoering', 'Nieuwstaat', 'Aanrader', 'Genre', 'Aantal', ''],
    [true, 'De verzonnen zee ', 'Verbeek, Mira', '0-306-40615-2', 'Uitgeverij Fictie', 1999, 'nederlands', 210, 'paperback', 'Ja', 'Robin', 'roman', '', 'donatie Kees Voorbeeld'],
    [false, '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Titel', 'Auteur(s)', 'ISBN', '', '', '', '', '', '', '', '', '', ''],
    [false, 'Stille lichten', 'Aerts, Noor', '12345', '', '', 'EN', '', 'Hardcover', 'nee', '', 'Roman', 2, 'niet op site']
  ];
  const rijen = M.leesBronRijen(waarden, 'boek');
  assert.strictEqual(rijen.length, 2);
  assert.strictEqual(rijen[0].titel, 'De verzonnen zee');
  assert.strictEqual(rijen[0].isbn, '9780306406157');
  assert.strictEqual(rijen[0].taal, 'Nederlands');
  assert.strictEqual(rijen[0].uitvoering, 'Paperback');
  assert.strictEqual(rijen[0].nieuwstaat, 'ja');
  assert.strictEqual(rijen[0].herkomst, 'donatie Kees Voorbeeld');
  assert.strictEqual(rijen[0].aantal, 1);
  assert.strictEqual(rijen[1].isbn, '');
  assert.strictEqual(rijen[1].isbn_origineel, '12345');
  assert.strictEqual(rijen[1].taal, 'Engels');
  assert.strictEqual(rijen[1].aantal, 2);
  assert.ok(!('selectievakje' in rijen[0]));
});

test('maakCatalogus mag opnieuw: geen dubbels, handmatige correctie blijft', () => {
  const bron = [
    { soort: 'boek', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', isbn: '9780306406157', uitgeverij: 'Fictie', jaartal: 1999, taal: 'Nederlands', paginas: 210, uitvoering: 'Paperback', nieuwstaat: 'ja', aanrader: '', genre: 'roman', aantal: 1, herkomst: 'gift', isbn_origineel: '' },
    { soort: 'zine', titel: 'Glitterbrief #3', auteur: 'Collectief Fictief', isbn: '', uitgeverij: '', jaartal: '', taal: '', paginas: '', uitvoering: '', nieuwstaat: '', aanrader: '', genre: 'verkoop', aantal: 1, herkomst: 'niet op site', isbn_origineel: '' }
  ];
  const catalogus = [];
  let n = 0;
  const id = (s) => (s === 'zine' ? 'Z' : 'B') + (++n);
  const inst = instellingen();
  let t = M.voegBronSamen(catalogus, JSON.parse(JSON.stringify(bron)), id, inst);
  assert.strictEqual(t.nieuw, 2);
  assert.strictEqual(catalogus[1].uitleenbaar, 'nee');
  assert.strictEqual(catalogus[1].publiek, 'nee');
  catalogus[0].titel = 'De verzonnen zee (verbeterd)';
  catalogus[0].uitgeverij = '';
  t = M.voegBronSamen(catalogus, JSON.parse(JSON.stringify(bron)), id, inst);
  assert.strictEqual(t.nieuw, 0);
  assert.strictEqual(catalogus.length, 2);
  assert.strictEqual(catalogus[0].titel, 'De verzonnen zee (verbeterd)');
  assert.strictEqual(catalogus[0].uitgeverij, 'Fictie');
  assert.strictEqual(catalogus[0].boek_id, 'B1');
});

test('genres met andere schrijfwijze komen één keer in Onderwerpen', () => {
  const rijen = [];
  const nieuw = M.vulOnderwerpenAan(rijen, [{ genre: 'Young Adult' }, { genre: 'Young adult' }, { genre: 'young adult' }, { genre: 'Erotica' }, { genre: 'erotica' }]);
  assert.strictEqual(nieuw, 2);
  const ya = rijen.find((r) => r.genre.toLowerCase() === 'young adult');
  assert.strictEqual(ya.aantal_boeken, 3);
  assert.strictEqual(ya.filtergroepen, 'Young adult');
  assert.strictEqual(rijen.find((r) => r.genre.toLowerCase() === 'erotica').filtergroepen, 'Erotica en BDSM');
});

test('filtergroepen: vertaaltabel, extra onderwerpen, klassieker en zines', () => {
  const vertaal = M.vertaalTabel([{ genre: 'Roman', filtergroepen: 'Fictie' }]);
  const g = M.filtergroepenVan({ genre: 'roman', extra_onderwerpen: 'gender; Seksualiteit', klassieker: true, soort: 'boek' }, vertaal);
  gelijk(Array.from(g), ['Fictie', 'Gender', 'Seksualiteit', 'Klassiekers']);
  gelijk(Array.from(M.filtergroepenVan({ genre: 'verkoop', soort: 'zine' }, vertaal)), ['Zines']);
});

console.log('\nGoodreads');

test('koppeling op ISBN vult enkel lege velden aan', () => {
  const catalogus = [{ boek_id: 'B1', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', isbn: '9780306406157', uitgeverij: '', jaartal: 2001, paginas: '' }];
  const gr = [{ Title: 'De verzonnen zee', Author: 'Mira Verbeek', 'Author l-f': 'Verbeek, Mira', ISBN: '="0306406152"', ISBN13: '="9780306406157"', Publisher: 'Fictie & Zonen', 'Year Published': '2001', 'Number of Pages': '212' }];
  const r = M.koppelGoodreads(catalogus, gr);
  const velden = r.aanvullingen.map((a) => a.veld).sort();
  gelijk(velden, ['paginas', 'uitgeverij']);
  assert.strictEqual(r.naTeKijken.length, 0);
});
test('verschillende waarde: Catalogus blijft, beide waarden naar Na te kijken', () => {
  const catalogus = [{ boek_id: 'B1', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', isbn: '9780306406157', uitgeverij: 'Fictie', jaartal: 1999, paginas: 210 }];
  const gr = [{ Title: 'De verzonnen zee', 'Author l-f': 'Verbeek, Mira', ISBN13: '="9780306406157"', Publisher: 'Fictie', 'Year Published': '2004', 'Number of Pages': '210' }];
  const r = M.koppelGoodreads(catalogus, gr);
  assert.strictEqual(r.aanvullingen.length, 0);
  assert.strictEqual(r.naTeKijken.length, 1);
  assert.strictEqual(r.naTeKijken[0].veld, 'jaartal');
  assert.strictEqual(r.naTeKijken[0].waarde_catalogus, 1999);
  assert.strictEqual(r.naTeKijken[0].waarde_bron, 2004);
});
test('koppeling op titel en auteur (zonder ISBN), ISBN enkel als voorstel', () => {
  const catalogus = [{ boek_id: 'B2', titel: 'Twee kasten vol', auteur: 'Dewit, Rein', isbn: '', uitgeverij: '', jaartal: '', paginas: '' }];
  const gr = [{ Title: 'Twee Kasten Vol: een essay (Reeks Fictief, #2)', 'Author l-f': 'Dewit, Rein', ISBN13: '="9780306406157"', Publisher: 'Huis', 'Year Published': '2010', 'Number of Pages': '99' }];
  const r = M.koppelGoodreads(catalogus, gr);
  assert.strictEqual(r.aanvullingen.length, 3);
  assert.strictEqual(r.naTeKijken.length, 1);
  assert.strictEqual(r.naTeKijken[0].veld, 'isbn');
});
test('enkel de titel komt overeen: twijfel, niets ingevuld', () => {
  const catalogus = [{ boek_id: 'B3', titel: 'Stille lichten', auteur: 'Aerts, Noor', isbn: '', uitgeverij: '', jaartal: '', paginas: '' }];
  const gr = [{ Title: 'Stille lichten', 'Author l-f': 'Janssens, Piet', Author: 'Piet Janssens', Publisher: 'X', 'Year Published': '2015' }];
  const r = M.koppelGoodreads(catalogus, gr);
  assert.strictEqual(r.aanvullingen.length, 0);
  assert.strictEqual(r.naTeKijken.length, 1);
  assert.strictEqual(r.naTeKijken[0].veld, 'koppeling');
});
test('Na te kijken: zelfde twijfel twee keer, één rij', () => {
  const rijen = [];
  const item = { boek: { boek_id: 'B1', titel: 'T' }, veld: 'jaartal', waarde_catalogus: 1999, waarde_bron: 2004, opmerking: '' };
  M.voegNaTeKijkenToe(rijen, [item], 'Goodreads', '2026-10-23');
  M.voegNaTeKijkenToe(rijen, [item], 'Goodreads', '2026-10-24');
  assert.strictEqual(rijen.length, 1);
});

console.log('\nOpen Library');

test('vult enkel lege velden en bouwt de cover-link', () => {
  const boek = { isbn: '9780306406157', uitgeverij: 'Bestaand', jaartal: '', paginas: '', taal: '', beschrijving: '', cover_url: '' };
  const v = M.verwerkOpenLibrary(boek, { publishers: ['Ander'], publish_date: 'March 1999', number_of_pages: 321, languages: [{ key: '/languages/eng' }], covers: [12345], description: { value: 'Een verzonnen beschrijving.' } });
  assert.strictEqual(v.uitgeverij, undefined);
  assert.strictEqual(v.jaartal, 1999);
  assert.strictEqual(v.paginas, 321);
  assert.strictEqual(v.taal, 'Engels');
  assert.strictEqual(v.cover_url, 'https://covers.openlibrary.org/b/id/12345-M.jpg');
  assert.strictEqual(v.beschrijving, 'Een verzonnen beschrijving.');
});

console.log('\nZoeken en filteren');

const Z = M.MadrigalZoeken;
const F = M.MadrigalFilters;
const voorbeeldBoeken = [
  { id: 'B1', t: 'The Color of Water', a: 'Baldwin, Jamie', u: 'Penguin', i: '9780306406157', j: 1965, l: 'Engels', g: ['Fictie', 'Klassiekers'], n: 'tweedehands', v: 'Paperback', r: ['Robin'], b: { c: 'beschikbaar' } },
  { id: 'B2', t: 'Een kamer voor Émile', a: 'Zola, Lou', u: 'Fictieve Pers', j: 2021, l: 'Nederlands', g: ['Gender'], n: 'nieuw', v: 'Hardcover', b: { c: 'uitgeleend' } },
  { id: 'B3', t: 'Le désir', a: 'Ardent, Camille', u: 'Maison', j: 1992, l: 'Frans', g: ['Seksualiteit', 'Fictie'], n: 'tweedehands', r: ['Robin', 'Kai'], b: { c: 'beschikbaar' } }
];
const index = Z.maakIndex(voorbeeldBoeken);

test('zoeken negeert hoofdletters, accenten en lidwoorden', () => {
  gelijk(Z.zoek(index, 'emile').map((r) => r.boek.id), ['B2']);
  gelijk(Z.zoek(index, 'DESIR').map((r) => r.boek.id), ['B3']);
  gelijk(Z.zoek(index, 'the color').map((r) => r.boek.id), ['B1']);
});
test('zoeken vergeeft tikfouten', () => {
  gelijk(Z.zoek(index, 'baldwn').map((r) => r.boek.id), ['B1']);
  gelijk(Z.zoek(index, 'kamr').map((r) => r.boek.id), ['B2']);
});
test('zoeken op uitgeverij en op ISBN-10 met streepjes', () => {
  gelijk(Z.zoek(index, 'fictieve pers').map((r) => r.boek.id), ['B2']);
  gelijk(Z.zoek(index, '0-306-40615-2').map((r) => r.boek.id), ['B1']);
});
test('filters: groep, taal, periode, aanrader, beschikbaar', () => {
  gelijk(F.pasToe(voorbeeldBoeken, { groep: 'Fictie' }).map((b) => b.id), ['B1', 'B3']);
  gelijk(F.pasToe(voorbeeldBoeken, { groep: 'Fictie', taal: 'Frans' }).map((b) => b.id), ['B3']);
  gelijk(F.pasToe(voorbeeldBoeken, { periode: 'Voor 1970' }).map((b) => b.id), ['B1']);
  gelijk(F.pasToe(voorbeeldBoeken, { aanrader: 'Aanrader van Kai' }).map((b) => b.id), ['B3']);
  gelijk(F.pasToe(voorbeeldBoeken, { beschikbaar: true }).map((b) => b.id), ['B1', 'B3']);
  gelijk(F.pasToe(voorbeeldBoeken, { staat: 'Nieuw' }).map((b) => b.id), ['B2']);
});
test('opties tellen boeken per keuze', () => {
  const o = F.opties(voorbeeldBoeken, ['Gender', 'Seksualiteit', 'Fictie']);
  gelijk(o.groep.map((x) => x.waarde), ['Gender', 'Seksualiteit', 'Fictie', 'Klassiekers']);
  assert.strictEqual(o.groep.find((x) => x.waarde === 'Fictie').aantal, 2);
});
test('sorteren op titel negeert lidwoord, op jaartal nieuwste eerst', () => {
  gelijk(F.sorteer(voorbeeldBoeken, 'titel').map((b) => b.id), ['B1', 'B3', 'B2']);
  gelijk(F.sorteer(voorbeeldBoeken, 'jaar-nieuw').map((b) => b.id), ['B2', 'B3', 'B1']);
  gelijk(F.sorteer(voorbeeldBoeken, 'auteur').map((b) => b.id), ['B3', 'B1', 'B2']);
});

console.log('\nVervaldatums');

test('vervaldatum: 4 weken later, op een vrijdag', () => {
  const inst = instellingen();
  assert.strictEqual(M.berekenVervaldatum('2026-10-23', inst), '2026-11-20');
  // Uitgeleend op een woensdag: opgeschoven naar de vrijdag erna.
  assert.strictEqual(M.berekenVervaldatum('2026-10-21', inst), '2026-11-20');
});
test('vervaldatum op een gesloten vrijdag schuift naar de volgende open vrijdag', () => {
  const inst = instellingen({ gesloten_data: '20/11/2026, 27/11/2026' });
  assert.strictEqual(M.berekenVervaldatum('2026-10-23', inst), '2026-12-04');
});
test('statusteksten met kleurcode en tekst', () => {
  const inst = instellingen();
  const u = { vervaldatum: '2026-11-20', oorspronkelijke_vervaldatum: '2026-11-20', aantal_verlengingen: 0 };
  let s = M.uitleenStatus(u, '2026-11-02', inst);
  assert.strictEqual(s.code, 'optijd');
  assert.strictEqual(s.tekst, 'Terug tegen vrijdag 20 november (nog 18 dagen)');
  s = M.uitleenStatus(u, '2026-11-15', inst);
  assert.strictEqual(s.code, 'binnenkort');
  assert.strictEqual(s.tekst, 'Vervalt vrijdag 20 november (nog 5 dagen)');
  s = M.uitleenStatus(u, '2026-12-02', inst);
  assert.strictEqual(s.code, 'telaat');
  assert.strictEqual(s.tekst, 'Te laat sinds vrijdag 20 november (12 dagen)');
  s = M.uitleenStatus({ vervaldatum: '2026-12-18', oorspronkelijke_vervaldatum: '2026-11-20', aantal_verlengingen: 1 }, '2026-11-25', inst);
  assert.strictEqual(s.verlengd, true);
  assert.strictEqual(s.verlengdTekst, 'Verlengd: eerst vrijdag 20 november, nu vrijdag 18 december');
});
test('ophaaltermijn: 2 openingsdagen, gesloten vrijdag telt niet', () => {
  const inst = instellingen({ gesloten_data: '06/11/2026' });
  // Klaar op vrijdag 30/10. 6/11 is dicht, dus de 2 openingsdagen zijn 13/11 en 20/11.
  assert.strictEqual(M.berekenOphaalTermijn('2026-10-30', inst), '2026-11-20');
});

console.log('\nUitlenen en grenzen');

test('uitlenen geeft de terugbrengdatum terug', () => {
  const s = maakStaat();
  const r = uitleen(s, 'B0001', '1');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.terugTekst, 'Breng terug tegen vrijdag 20 november');
  assert.strictEqual(s.uitleningen[0].exemplaar, 'B0001-1');
  assert.strictEqual(s.uitleningen[0].borg, 5);
});
test('niet uitleenbaar en al uitgeleend worden geweigerd', () => {
  const s = maakStaat();
  assert.strictEqual(uitleen(s, 'Z0001', '1').ok, false);
  uitleen(s, 'B0001', '1');
  const r = uitleen(s, 'B0001-1', '2');
  assert.strictEqual(r.ok, false);
  assert.ok(/al uitgeleend/.test(r.fout));
});
test('derde boek zonder reden: melding, geen uitlening', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  uitleen(s, 'B0002-1', '1');
  const r = uitleen(s, 'B0003', '1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.grenzen[0].id, 'max_boeken');
  assert.strictEqual(r.grenzen[0].melding, 'Deze lener heeft al 2 boeken. Het maximum is 2.');
  assert.strictEqual(s.uitleningen.length, 2);
  assert.strictEqual(s.uitzonderingen.length, 0);
});
test('derde boek met reden: uitlening en uitzondering genoteerd', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  uitleen(s, 'B0002-1', '1');
  const r = uitleen(s, 'B0003', '1', { uitzondering: { reden: 'Leest voor een thesis' } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.uitleningen.length, 3);
  assert.strictEqual(s.uitzonderingen.length, 1);
  assert.strictEqual(s.uitzonderingen[0].grens, 'Maximum aantal boeken per lener');
  assert.strictEqual(s.uitzonderingen[0].reden, 'Leest voor een thesis');
  assert.strictEqual(s.uitzonderingen[0].wie, 'Testvrijwilliger');
});
test('een te laat boek: status en grens bij uitlenen', () => {
  const s = maakStaat('2026-12-04');
  s.uitleningen.push({ uitlening_id: 'U00001', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '1', datum_uit: '2026-10-23', oorspronkelijke_vervaldatum: '2026-11-20', vervaldatum: '2026-11-20', datum_terug: '', aantal_verlengingen: 0 });
  const info = M.uitleningInfo(s, s.uitleningen[0]);
  assert.strictEqual(info.status.code, 'telaat');
  assert.strictEqual(info.status.tekst, 'Te laat sinds vrijdag 20 november (14 dagen)');
  const r = uitleen(s, 'B0003', '1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.grenzen[0].id, 'te_laat');
});

console.log('\nVerlengen');

test('verlengen zonder reservatie: 4 weken erbij', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const id = s.uitleningen[0].uitlening_id;
  const r = M.verlengen(s, { uitlening_id: id });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.vervaldatum, '2026-12-18');
  assert.strictEqual(s.uitleningen[0].aantal_verlengingen, 1);
  assert.strictEqual(s.uitleningen[0].oorspronkelijke_vervaldatum, '2026-11-20');
});
test('tweede verlenging vraagt een uitzondering', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const id = s.uitleningen[0].uitlening_id;
  M.verlengen(s, { uitlening_id: id });
  const r = M.verlengen(s, { uitlening_id: id });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.grenzen[0].id, 'max_verlengingen');
  const r2 = M.verlengen(s, { uitlening_id: id, uitzondering: { reden: 'Ziek geweest' } });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(s.uitleningen[0].aantal_verlengingen, 2);
});
test('verlengen met een reservatie van iemand anders toont wie wacht', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  s.vandaag = '2026-10-30';
  assert.strictEqual(M.reserveren(s, { boek_id: 'B0001', lenersnummer: '2' }).ok, true);
  const id = s.uitleningen[0].uitlening_id;
  const r = M.verlengen(s, { uitlening_id: id });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.grenzen[0].id, 'verlengen_bij_reservatie');
  assert.ok(r.grenzen[0].melding.indexOf('lener 2 (Jo), sinds vrijdag 30 oktober') > -1);
  const r2 = M.verlengen(s, { uitlening_id: id, uitzondering: { reden: 'Jo gaf akkoord' } });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(s.uitzonderingen[0].grens, 'Verlengen terwijl iemand anders wacht');
});

console.log('\nBoek met 2 exemplaren en reservaties');

test('"1 van 2 beschikbaar", dan uitgeleend, dan gereserveerd', () => {
  const s = maakStaat();
  const boek = s.catalogus[1];
  assert.strictEqual(M.beschikbaarheid(s, boek).label, '2 van 2 beschikbaar');
  uitleen(s, 'B0002-1', '1');
  assert.strictEqual(M.beschikbaarheid(s, boek).label, '1 van 2 beschikbaar');
  // Reserveren kan niet zolang er een exemplaar in de kast staat.
  assert.strictEqual(M.reserveren(s, { boek_id: 'B0002', lenersnummer: '3' }).ok, false);
  uitleen(s, 'B0002-2', '2');
  const b = M.beschikbaarheid(s, boek);
  assert.strictEqual(b.code, 'uitgeleend');
  assert.strictEqual(b.label, 'Uitgeleend, verwacht terug op vrijdag 20 november');
  assert.strictEqual(M.reserveren(s, { boek_id: 'B0002', lenersnummer: '3' }).ok, true);
  assert.strictEqual(M.beschikbaarheid(s, boek).code, 'gereserveerd');
});
test('teruggebracht exemplaar gaat naar de wachtrij, met melding om apart te leggen', () => {
  const s = maakStaat();
  uitleen(s, 'B0002-1', '1');
  uitleen(s, 'B0002-2', '2');
  M.reserveren(s, { boek_id: 'B0002', lenersnummer: '3' });
  s.vandaag = '2026-10-30';
  const id = s.uitleningen[1].uitlening_id;
  const r = M.terugbrengen(s, { uitlening_id: id, borg_terugbetaald: true });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.apartLeggen[0].tekst, 'Leg dit boek apart voor lener 3 (Alex)');
  assert.strictEqual(s.uitleningen[1].borg_terugbetaald, '2026-10-30');
  assert.strictEqual(s.reservaties[0].status, 'klaar om op te halen');
  assert.strictEqual(s.reservaties[0].exemplaar, 'B0002-2');
  assert.strictEqual(s.reservaties[0].ophalen_tot, '2026-11-13');
  // Iemand anders wil het apart gelegde exemplaar lenen: grens.
  const ander = uitleen(s, 'B0002-2', '2');
  assert.strictEqual(ander.ok, false);
  assert.strictEqual(ander.grenzen.map((g) => g.id).indexOf('gereserveerd_voor_ander') > -1, true);
  // De juiste lener haalt het af.
  const juist = uitleen(s, 'B0002-2', '3');
  assert.strictEqual(juist.ok, true);
  assert.strictEqual(s.reservaties[0].status, 'afgehaald');
});
test('niet afgehaalde reservatie vervalt en gaat naar de volgende', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  M.reserveren(s, { boek_id: 'B0001', lenersnummer: '2' });
  s.vandaag = '2026-10-24';
  M.reserveren(s, { boek_id: 'B0001', lenersnummer: '3' });
  s.vandaag = '2026-10-30';
  M.terugbrengen(s, { uitlening_id: s.uitleningen[0].uitlening_id, borg_terugbetaald: false });
  s.vandaag = '2026-11-14';
  const m = M.verwerkVervallenReservaties(s);
  assert.strictEqual(s.reservaties[0].status, 'vervallen');
  assert.strictEqual(s.reservaties[1].status, 'klaar om op te halen');
  assert.strictEqual(m[0].tekst, 'Leg dit boek apart voor lener 3 (Alex)');
});

console.log('\nLeners en privacy');

test('nieuwe lener: toestemming verplicht, dubbel herkend op telefoon', () => {
  const s = maakStaat();
  assert.strictEqual(M.nieuweLener(s, { voornaam: 'Kim', telefoon: '0470 00 00 09', toestemming: false }).ok, false);
  assert.strictEqual(M.nieuweLener(s, { voornaam: 'Kim', toestemming: true }).ok, false);
  const r = M.nieuweLener(s, { voornaam: 'Kim', telefoon: '0470 00 00 09', toestemming: true });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.lenersnummer, 4);
  const dubbel = M.nieuweLener(s, { voornaam: 'Kim', telefoon: '+32 470 00 00 09', toestemming: true });
  assert.strictEqual(dubbel.ok, false);
});
test('balie ziet geen contactgegevens', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const tekst = JSON.stringify(M.balieGegevens(s));
  assert.ok(tekst.indexOf('sam@voorbeeld.test') === -1);
  assert.ok(tekst.indexOf('0470') === -1);
  assert.ok(tekst.indexOf('Achternaamtest') === -1);
});
test('bestuur ziet te laat met contact en een ingevulde herinnering', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  s.vandaag = '2026-12-01';
  const d = M.bestuurGegevens(s, []);
  assert.strictEqual(d.telaat.length, 1);
  assert.strictEqual(d.telaat[0].email, 'sam@voorbeeld.test');
  assert.ok(d.telaat[0].herinnering.indexOf('Hoi Sam') === 0);
  assert.ok(d.telaat[0].herinnering.indexOf('vrijdag 20 november') > -1);
  assert.strictEqual(d.borgen.ingehouden.totaal, 5);
  assert.strictEqual(d.borgen.ingehouden.perBetaalwijze.cash, 5);
});
test('publieke catalogus toont geen herkomst, geen niet-publieke boeken en geen leners', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const p = M.bouwPubliekeCatalogus(s, [{ genre: 'Roman', filtergroepen: 'Fictie' }]);
  const tekst = JSON.stringify(p);
  assert.ok(tekst.indexOf('Kees Voorbeeld') === -1);
  assert.ok(tekst.indexOf('Het nachtboek') === -1);
  assert.ok(tekst.indexOf('Sam') === -1);
  assert.ok(tekst.indexOf('code') === -1);
  const zine = p.boeken.find((b) => b.id === 'Z0001');
  assert.strictEqual(zine.b.l, 'Te koop in de bib, niet uitleenbaar');
  gelijk(Array.from(zine.g), ['Zines']);
});
test('privacy-opruiming na de bewaartermijn', () => {
  const s = maakStaat('2027-12-01');
  s.leners[2].actief = 'nee';
  s.uitleningen.push({ uitlening_id: 'U1', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '3', datum_uit: '2026-10-01', vervaldatum: '2026-10-29', datum_terug: '2026-10-29' });
  s.uitleningen.push({ uitlening_id: 'U2', exemplaar: 'B0003-1', boek_id: 'B0003', lenersnummer: '1', datum_uit: '2027-11-01', vervaldatum: '2027-11-26', datum_terug: '' });
  const t = M.ruimOpStaat(s);
  assert.strictEqual(s.uitleningen[0].lenersnummer, '');
  assert.strictEqual(s.uitleningen[1].lenersnummer, '1');
  assert.strictEqual(t.leners, 1);
  assert.strictEqual(s.leners[2]._verwijderen, true);
  assert.ok(!s.leners[0]._verwijderen);
});

console.log('\nOverzetten uit het oude uitleenblad');

test('lopende uitleningen overnemen: één lener per persoon, twijfel apart', () => {
  const s = maakStaat();
  s.leners = [];
  const waarden = [
    ['Boek', 'Auteur', 'Voornaam', 'Achternaam', 'Telefoon', 'E-mail', 'datum ontlening', 'datum terug', 'Borg (cash/QR)', 'Gift', 'reminder mail', 'boek terug op...'],
    ['De verzonnen zee', 'Mira Verbeek', 'Robin', 'Testpersoon', '0470/00.00.07', '', '02/10/2026', '30/10/2026', '5 QR', '2', '28/10/2026', ''],
    ['Stille lichten', 'Noor Aerts', 'Robin', 'Testpersoon', '+32 470 00 00 07', '', '02/10/2026', '30/10/2026', 'cash', '', '', ''],
    ['Twee kasten vol', 'Rein Dewit', 'Lou', '', '', 'lou@voorbeeld.test', '01/09/2026', '29/09/2026', '5 cash', '', '', '29/09/2026'],
    ['Een boek dat niet bestaat', 'Niemand', 'Lou', '', '', 'lou@voorbeeld.test', '01/10/2026', '', '', '', '', '']
  ];
  const r = M.verwerkOudeUitleningen(s, M.leesOudeUitleningen(waarden));
  assert.strictEqual(r.uitleningen, 2);
  assert.strictEqual(r.leners, 2);
  assert.strictEqual(r.naTeKijken.length, 1);
  assert.strictEqual(s.uitleningen[0].borg, 5);
  assert.strictEqual(s.uitleningen[0].betaalwijze_borg, 'QR');
  assert.strictEqual(s.uitleningen[0].laatste_herinnering, '2026-10-28');
  assert.strictEqual(s.uitleningen[0].vervaldatum, '2026-10-30');
  assert.strictEqual(s.uitleningen[1].borg, 5);
  assert.strictEqual(s.uitleningen[0].lenersnummer, s.uitleningen[1].lenersnummer);
  // Opnieuw uitvoeren maakt niets dubbel.
  const r2 = M.verwerkOudeUitleningen(s, M.leesOudeUitleningen(waarden));
  assert.strictEqual(r2.uitleningen, 0);
  assert.strictEqual(r2.leners, 0);
});

console.log('\nCellen');

test('formules en telefoonnummers blijven tekst', () => {
  assert.strictEqual(M.veiligeCel('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.strictEqual(M.veiligeCel('0470000001'), "'0470000001");
  assert.strictEqual(M.veiligeCel('Sam'), 'Sam');
});

console.log('\n' + geslaagd + ' geslaagd, ' + mislukt.length + ' mislukt');
if (mislukt.length) process.exit(1);
