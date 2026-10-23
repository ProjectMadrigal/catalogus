/**
 * Publiek.js
 * Stelt de publieke catalogus samen. Hier staat de lijst met velden die de
 * website mag zien. Alles wat hier niet staat (herkomst, leners, codes, ...)
 * verlaat de spreadsheet nooit via het publieke eindpunt.
 *
 * Om bandbreedte te sparen gebruiken we korte sleutels:
 *   id  boek-ID          t  titel           a  auteur        i  ISBN
 *   u   uitgeverij       j  jaartal         l  taal          p  pagina's
 *   v   uitvoering       n  nieuw/tweedehands                r  aanraders (lijst)
 *   g   filtergroepen    s  soort (boek/zine)                d  beschrijving
 *   c   cover-URL        b  beschikbaarheid { c: code, l: label, t: totaal, v: vrij,
 *                                           d: verwacht terug (datum), k: 1 als te koop }
 */

/** Bouwt het object dat het publieke eindpunt teruggeeft. */
function bouwPubliekeCatalogus(staat, onderwerpRijen) {
  var vertaal = vertaalTabel(onderwerpRijen);
  var boeken = [];
  staat.catalogus.forEach(function (rij) {
    if (isLeeg(rij.boek_id) || isLeeg(rij.titel)) return;
    if (jaNee(rij.publiek) === 'nee') return;
    var b = beschikbaarheid(staat, rij);
    var boek = {
      id: String(rij.boek_id),
      t: schoon(rij.titel),
      a: schoon(rij.auteur),
      g: filtergroepenVan(rij, vertaal),
      s: normaliseerTekst(rij.soort) === 'zine' ? 'zine' : 'boek',
      b: { c: b.code, l: b.label, t: b.totaal, v: b.beschikbaar }
    };
    // Datum van verwachte terugkeer en "te koop": zo maakt de website het label in elke taal op.
    if (b.code === 'uitgeleend' && b.terug && b.terug >= staat.vandaag) boek.b.d = b.terug;
    if (b.code === 'niet_uitleenbaar' && normaliseerTekst(rij.genre) === 'verkoop') boek.b.k = 1;
    // Lege velden laten we weg: dat maakt de lijst kleiner.
    var extra = {
      i: schoon(rij.isbn), u: schoon(rij.uitgeverij), j: parseerGetal(rij.jaartal) || '',
      l: schoon(rij.taal), p: parseerGetal(rij.paginas) || '', v: schoon(rij.uitvoering),
      n: jaNee(rij.nieuwstaat) === 'ja' ? 'nieuw' : (jaNee(rij.nieuwstaat) === 'nee' ? 'tweedehands' : ''),
      d: schoon(rij.beschrijving), c: veiligeCoverUrl(rij.cover_url)
    };
    Object.keys(extra).forEach(function (k) { if (!isLeeg(extra[k])) boek[k] = extra[k]; });
    var aanraders = splitsLijst(String(rij.aanrader || '').replace(/ en | & /g, ','));
    if (aanraders.length) boek.r = aanraders;
    boeken.push(boek);
  });
  // Filtergroepen: eerst de standaardvolgorde, dan eventuele eigen groepen.
  var groepen = FILTERGROEPEN.slice();
  boeken.forEach(function (b) { b.g.forEach(function (g) { if (groepen.indexOf(g) === -1) groepen.push(g); }); });
  return {
    bijgewerkt: staat.vandaag,
    teksten: publiekeTeksten(staat.inst),
    filtergroepen: groepen,
    boeken: boeken
  };
}

/** Enkel https-links naar afbeeldingen. Zo kan er geen vreemde code via een cover binnensluipen. */
function veiligeCoverUrl(url) {
  var u = schoon(url);
  return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
}
