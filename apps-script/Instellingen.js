/**
 * Instellingen.js
 * De standaardwaarden voor het tabblad Instellingen, en het inlezen ervan.
 * Wil je een nieuwe instelling toevoegen? Zet ze in de lijst hieronder en voer
 * daarna "Installeer tabbladen" uit: ontbrekende sleutels worden aangevuld,
 * bestaande waarden blijven staan.
 */

var STANDAARD_INSTELLINGEN = [
  ['uitleentermijn_weken', 4, 'Hoeveel weken een lener een boek mag houden.'],
  ['verlengingstermijn_weken', 4, 'Hoeveel weken er bij een verlenging bijkomen.'],
  ['max_verlengingen', 1, 'Hoe vaak een lener een boek mag verlengen. Meer kan, maar dan als uitzondering met een reden.'],
  ['verlengen_niet_bij_reservatie', 'ja', 'ja: verlengen kan niet (zonder uitzondering) als iemand anders het boek gereserveerd heeft.'],
  ['max_boeken_per_lener', 2, 'Hoeveel boeken een lener tegelijk mag lenen. Meer kan, maar dan als uitzondering met een reden.'],
  ['borg_per_boek', 5, 'Borg in euro per boek. Het uitleenscherm vult dit bedrag voor.'],
  ['borg_betaalwijzen', 'cash, QR', 'Hoe iemand de borg kan betalen, gescheiden door komma\'s.'],
  ['gift_mogelijk', 'ja', 'ja: het uitleenscherm toont een veld voor een vrijwillige gift.'],
  ['openingsdagen', 'vrijdag', 'Op welke weekdagen de bib open is, gescheiden door komma\'s.'],
  ['terugbrengdatum_op_openingsdag', 'ja', 'ja: de terugbrengdatum schuift op naar de eerstvolgende openingsdag.'],
  ['gesloten_data', '', 'Openingsdagen waarop de bib toch dicht is. Schrijf ze als 25/12/2026, gescheiden door komma\'s.'],
  ['waarschuwing_dagen_voor_vervaldatum', 7, 'Vanaf hoeveel dagen voor de vervaldatum een uitlening "vervalt binnenkort" krijgt.'],
  ['ophaaltermijn_openingsdagen', 2, 'Hoeveel openingsdagen een gereserveerd boek apart blijft liggen. Daarna gaat het naar de volgende in de wachtrij.'],
  ['toegangscode_balie', '', 'Code voor de vrijwilligers aan de balie. Wijzig ze als ze uitlekt.'],
  ['code_bestuur', '', 'Code voor het bestuursscherm. Geef ze enkel aan het bestuur.'],
  ['bewaartermijn_afgesloten_uitleningen_maanden', 12, 'Na hoeveel maanden de koppeling tussen een teruggebrachte uitlening en de lener gewist wordt.'],
  ['goodreads_shelf', '', 'Naam van de Goodreads-shelf met de boeken van Madrigal, precies zoals op Goodreads. Leeg: alle boeken uit de export.'],
  ['google_books_api_key', '', 'Optioneel. Een sleutel voor de Google Books-API, zodat covers sneller opgezocht worden. Leeg werkt ook, maar trager.'],
  ['zines_te_koop_uitleenbaar', 'nee', 'nee: zines met genre "verkoop" zijn niet uitleenbaar.'],
  ['tekst_welkom', 'Welkom in de catalogus van Project Madrigal, de queer bib van Antwerpen. Zoek, snuister en kom langs om te lenen.', 'Welkomsttekst bovenaan de publieke catalogus.'],
  ['tekst_uitleg_lenen', 'Je leent gratis, je betaalt enkel 5 euro borg per boek. Die krijg je terug als je het boek terugbrengt. Je mag 2 boeken tegelijk lenen, voor 4 weken. Kom langs op vrijdag tijdens de openingsuren.', 'Uitleg over lenen in de publieke catalogus: wanneer open, hoe lang, hoeveel.'],
  ['tekst_privacy', 'We bewaren enkel je voornaam, eventueel je achternaam, je telefoonnummer en/of e-mailadres, en je lenersnummer. We gebruiken die enkel om je uitleningen op te volgen en je te herinneren als een boek terug moet. Enkel het bestuur ziet je contactgegevens. Na een teruggebracht boek wissen we de koppeling met jou na 12 maanden. Wil je je gegevens inkijken of laten wissen? Vraag het aan de balie of mail naar [vul het mailadres van het bestuur in].', 'Privacyverklaring bij het inschrijven en in de publieke catalogus.'],
  ['tekst_herinnering', 'Hoi {voornaam}, je leende bij Project Madrigal "{titel}". Dat boek moest terug op {vervaldatum}. Breng je het binnenkort binnen? Lukt dat niet, laat het ons dan even weten. Dank je!', 'Herinnering voor een boek dat te laat is. Gebruik {voornaam}, {titel} en {vervaldatum}.'],
  ['tekst_herinnering_binnenkort', 'Hoi {voornaam}, een vriendelijke herinnering: "{titel}" mag terug naar Project Madrigal op {vervaldatum}. Wil je het langer houden? Laat het ons weten, dan verlengen we het. Veel leesplezier!', 'Herinnering voor een boek dat binnenkort vervalt.']
];

/** Weekdagen als tekst naar het getal van de weekdag (0 = zondag). */
function weekdagNummers(waarde) {
  return splitsLijst(waarde).map(function (w) {
    return WEEKDAGEN.indexOf(normaliseerTekst(w));
  }).filter(function (n) { return n > -1; });
}

/**
 * Zet de ruwe waarden uit het tabblad om naar bruikbare instellingen.
 * ruw: object met sleutel -> waarde zoals in de spreadsheet.
 * Ontbrekende of onleesbare waarden krijgen de standaardwaarde.
 */
function verwerkInstellingen(ruw) {
  var inst = {};
  STANDAARD_INSTELLINGEN.forEach(function (rij) {
    var sleutel = rij[0];
    var standaard = rij[1];
    var waarde = ruw.hasOwnProperty(sleutel) && !isLeeg(ruw[sleutel]) ? ruw[sleutel] : standaard;
    if (typeof standaard === 'number') {
      var getal = parseerGetal(waarde);
      inst[sleutel] = getal === null ? standaard : getal;
    } else if (standaard === 'ja' || standaard === 'nee') {
      inst[sleutel] = (jaNee(waarde) || standaard) === 'ja';
    } else {
      inst[sleutel] = isDatumObject(waarde) ? parseerDatum(waarde) : schoon(waarde);
    }
  });
  inst.openingsdagen = weekdagNummers(inst.openingsdagen);
  inst.borg_betaalwijzen = splitsLijst(inst.borg_betaalwijzen);
  inst.gesloten_data = splitsLijst(inst.gesloten_data).map(parseerDatum).filter(function (d) { return d; });
  // Een enkele datum als Date-object in de cel.
  if (isDatumObject(ruw.gesloten_data)) inst.gesloten_data = [parseerDatum(ruw.gesloten_data)];
  return inst;
}

/** Leest het tabblad Instellingen en geeft de verwerkte instellingen terug. */
function leesInstellingen() {
  var blad = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Instellingen');
  var ruw = {};
  if (blad) {
    blad.getDataRange().getValues().slice(1).forEach(function (rij) {
      var sleutel = schoon(rij[0]);
      if (sleutel) ruw[sleutel] = rij[1];
    });
  }
  return verwerkInstellingen(ruw);
}

/** Teksten die de publieke catalogus mag tonen. Nooit codes of andere interne waarden. */
function publiekeTeksten(inst) {
  return {
    welkom: inst.tekst_welkom,
    uitleg: inst.tekst_uitleg_lenen,
    privacy: inst.tekst_privacy
  };
}
