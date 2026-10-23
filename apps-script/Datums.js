/**
 * Datums.js
 * Alles over vervaldatums, openingsdagen en de status van een uitlening.
 * Datums zijn altijd tekst in de vorm "JJJJ-MM-DD". Zo speelt de tijdzone geen rol.
 */

var WEEKDAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** "2026-11-20" naar een Date in UTC (enkel om mee te rekenen). */
function naarUtc(datum) {
  var d = datum.split('-');
  return new Date(Date.UTC(Number(d[0]), Number(d[1]) - 1, Number(d[2])));
}

/** Date in UTC terug naar "JJJJ-MM-DD". */
function vanUtc(d) {
  return d.getUTCFullYear() + '-' + tweeCijfers(d.getUTCMonth() + 1) + '-' + tweeCijfers(d.getUTCDate());
}

/** Telt een aantal dagen op bij een datum (negatief mag ook). */
function telDagenOp(datum, dagen) {
  var d = naarUtc(datum);
  d.setUTCDate(d.getUTCDate() + dagen);
  return vanUtc(d);
}

/** Telt een aantal maanden op (negatief mag ook). 31 maart min 1 maand wordt 28 of 29 februari. */
function telMaandenOp(datum, maanden) {
  var d = naarUtc(datum);
  var dag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + maanden);
  var laatste = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dag, laatste));
  return vanUtc(d);
}

/** Aantal dagen van datum a tot datum b (positief als b later is). */
function dagenTussen(a, b) {
  return Math.round((naarUtc(b) - naarUtc(a)) / 86400000);
}

/** Weekdag als getal: 0 = zondag, 5 = vrijdag. */
function weekdag(datum) {
  return naarUtc(datum).getUTCDay();
}

/** Is de bib open op deze datum? Juiste weekdag en niet in gesloten_data. */
function isOpeningsdag(datum, inst) {
  return inst.openingsdagen.indexOf(weekdag(datum)) > -1 && inst.gesloten_data.indexOf(datum) === -1;
}

/**
 * De eerstvolgende openingsdag vanaf een datum.
 * inclusief = true: de datum zelf telt mee als die een openingsdag is.
 */
function volgendeOpeningsdag(datum, inst, inclusief) {
  if (!inst.openingsdagen.length) return datum;
  var d = inclusief ? datum : telDagenOp(datum, 1);
  // Veiligheidsgrens: hoogstens een jaar vooruit zoeken.
  for (var i = 0; i < 366; i++) {
    if (isOpeningsdag(d, inst)) return d;
    d = telDagenOp(d, 1);
  }
  return datum;
}

/**
 * Vervaldatum van een nieuwe uitlening:
 * uitleendatum plus de uitleentermijn, opgeschoven naar de eerstvolgende openingsdag.
 */
function berekenVervaldatum(datumUit, inst) {
  var d = telDagenOp(datumUit, inst.uitleentermijn_weken * 7);
  return inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(d, inst, true) : d;
}

/** Nieuwe vervaldatum na verlengen: huidige vervaldatum plus de verlengingstermijn. */
function berekenVerlenging(huidigeVervaldatum, inst) {
  var d = telDagenOp(huidigeVervaldatum, inst.verlengingstermijn_weken * 7);
  return inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(d, inst, true) : d;
}

/**
 * Tot wanneer ligt een gereserveerd boek apart?
 * Tot en met de zoveelste openingsdag na de dag waarop het boek klaarlag.
 */
function berekenOphaalTermijn(datumKlaar, inst) {
  var d = datumKlaar;
  for (var i = 0; i < Math.max(1, inst.ophaaltermijn_openingsdagen); i++) d = volgendeOpeningsdag(d, inst, false);
  return d;
}

/**
 * Datum als leesbare tekst: "vrijdag 20 november".
 * Valt de datum in een ander jaar dan vandaag, dan komt het jaar erbij.
 */
function datumTekst(datum, vandaag) {
  if (!datum) return '';
  var d = naarUtc(datum);
  var tekst = WEEKDAGEN[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MAANDEN[d.getUTCMonth()];
  if (vandaag && vandaag.slice(0, 4) !== datum.slice(0, 4)) tekst += ' ' + d.getUTCFullYear();
  return tekst;
}

/** Korte datum: "20/11/2026". */
function korteDatum(datum) {
  if (!datum) return '';
  var d = datum.split('-');
  return Number(d[2]) + '/' + Number(d[1]) + '/' + d[0];
}

/** "1 dag" of "5 dagen". */
function dagenTekst(n) {
  return n + (n === 1 ? ' dag' : ' dagen');
}

/**
 * Status van een lopende uitlening, met kleurcode én tekst.
 * Geeft terug:
 *   code:   'optijd', 'binnenkort' of 'telaat' (de kleur in de schermen)
 *   label:  korte tekst voor een label
 *   tekst:  volledige zin, bv. "Terug tegen vrijdag 20 november (nog 18 dagen)"
 *   verlengd, verlengdTekst: extra label als de uitlening verlengd is
 */
function uitleenStatus(uitlening, vandaag, inst) {
  var verval = uitlening.vervaldatum;
  var dagen = dagenTussen(vandaag, verval);
  var dt = datumTekst(verval, vandaag);
  var status;
  if (dagen < 0) {
    status = { code: 'telaat', label: 'Te laat', tekst: 'Te laat sinds ' + dt + ' (' + dagenTekst(-dagen) + ')' };
  } else if (dagen === 0) {
    status = { code: 'binnenkort', label: 'Vervalt vandaag', tekst: 'Vervalt vandaag, ' + dt };
  } else if (dagen <= inst.waarschuwing_dagen_voor_vervaldatum) {
    status = { code: 'binnenkort', label: 'Vervalt binnenkort', tekst: 'Vervalt ' + dt + ' (nog ' + dagenTekst(dagen) + ')' };
  } else {
    status = { code: 'optijd', label: 'Op tijd', tekst: 'Terug tegen ' + dt + ' (nog ' + dagenTekst(dagen) + ')' };
  }
  status.dagen = dagen;
  status.verlengd = Number(uitlening.aantal_verlengingen || 0) > 0;
  if (status.verlengd) {
    status.verlengdTekst = 'Verlengd: eerst ' + datumTekst(uitlening.oorspronkelijke_vervaldatum, vandaag) + ', nu ' + dt;
  }
  return status;
}
