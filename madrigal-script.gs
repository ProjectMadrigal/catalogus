/**
 * madrigal-script.gs
 * Alle code van de catalogus van Project Madrigal in één bestand.
 * Plak dit volledige bestand in Apps Script (Extensies > Apps Script).
 * De functies staan alfabetisch, zodat je ze makkelijk vindt naast "Uitvoeren".
 *
 * PAS DIT BESTAND NIET MET DE HAND AAN. Het wordt gemaakt uit de map
 * apps-script/ met: node tools/bundel.js
 * De uitleg per onderdeel staat bovenaan de bestanden in apps-script/.
 */

/* ==================== Vaste waarden ==================== */

var CACHE_SLEUTEL = 'publiek_v1';

var CACHE_DUUR_SECONDEN = 6 * 60 * 60; // het maximum van Google: 6 uur

var CACHE_STUK = 90000;                 // een cachewaarde mag hoogstens 100 kB zijn

/** Welke rol nodig is voor elke actie. */
var ACTIES = {
  aanmelden: 'balie',
  balieData: 'balie',
  uitlenen: 'balie',
  terugbrengen: 'balie',
  verlengen: 'balie',
  reserveren: 'balie',
  annuleerReservatie: 'balie',
  nieuweLener: 'balie',
  bestuurData: 'bestuur',
  borgTerugbetaald: 'bestuur',
  herinneringVerstuurd: 'bestuur',
  lenerAanpassen: 'bestuur'
};

/* ---------- Staat lezen en bewaren ---------- */

var BS_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var BS_MAX_LENGTE = 1000;

var BS_USER_AGENT = 'ProjectMadrigal-catalogus (Google Apps Script; queer bibliotheek Antwerpen)';

/** Kolomnamen in Stock en Zines, en hoe ze in de Catalogus heten. */
var BRONKOLOMMEN = {
  'titel': 'titel',
  'auteur s': 'auteur', 'auteurs': 'auteur', 'auteur': 'auteur',
  'isbn': 'isbn', 'isbn issn': 'isbn', 'issn': 'isbn', 'isbn of issn': 'isbn',
  'uitgeverij': 'uitgeverij',
  'jaartal': 'jaartal', 'jaar': 'jaartal',
  'taal': 'taal',
  'pagina s': 'paginas', 'paginas': 'paginas',
  'uitvoering': 'uitvoering',
  'nieuwstaat': 'nieuwstaat',
  'aanrader': 'aanrader',
  'genre': 'genre',
  'aantal': 'aantal'
};

/** De standaard filtergroepen op de website, in deze volgorde. */
var FILTERGROEPEN = ['Gender', 'Seksualiteit', 'Feminisme', 'Fictie', 'Klassiekers', 'Geschiedenis en maatschappij', 'Biografie', 'Poëzie', 'Graphic novel', 'Young adult', 'Pulp', 'Erotica en BDSM', 'Zines'];

/** Voorstellen voor de vertaaltabel: een genre met dit woord erin gaat naar deze groep. */
var ONDERWERP_VOORSTELLEN = [
  [/gender|trans|non ?binair|interseks|intersex/, 'Gender'],
  [/seks|sexualiteit|homo|lesb|queer|lgbt|holebi|coming out|gay|polyamor|relatie/, 'Seksualiteit'],
  [/femin|vrouw/, 'Feminisme'],
  [/roman|fictie|fiction|verhal|verhaal|proza|literatuur|thriller|detective|fantasy|science|kort/, 'Fictie'],
  [/geschied|histor|maatschap|politi|sociolog|activis|essay|non ?fictie|filosof|religie|kolonial|marx|fascis|ecolog|cultuur|onderzoek/, 'Geschiedenis en maatschappij'],
  [/biogra|^bio$|memoir|dagboek/, 'Biografie'],
  [/poezie|gedicht|poetry|poem/, 'Poëzie'],
  [/graphic|strip|comic|manga/, 'Graphic novel'],
  [/young adult|^ya$|jeugd|kinder/, 'Young adult'],
  [/pulp/, 'Pulp'],
  [/erotic|erotiek|bdsm|kink|fetish|leder|leather/, 'Erotica en BDSM'],
  [/zine/, 'Zines']
];

var WEEKDAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** Welke kolom van de Goodreads-export welk veld van de Catalogus aanvult. */
var GOODREADS_VELDEN = {
  uitgeverij: ['Publisher'],
  jaartal: ['Year Published', 'Original Publication Year'],
  paginas: ['Number of Pages']
};

var GB_PAUZE_MS = 400;

var GB_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var GB_TALEN = { nl: 'Nederlands', en: 'Engels', fr: 'Frans', de: 'Duits', es: 'Spaans', it: 'Italiaans', pt: 'Portugees' };

var GRENZEN = [
  {
    id: 'max_boeken',
    naam: 'Maximum aantal boeken per lener',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var aantal = lopendeUitleningenVan(ctx.staat, ctx.lener.lenersnummer).length;
      var max = ctx.inst.max_boeken_per_lener;
      if (aantal < max) return null;
      return 'Deze lener heeft al ' + aantal + (aantal === 1 ? ' boek' : ' boeken') + '. Het maximum is ' + max + '.';
    }
  },
  {
    id: 'te_laat',
    naam: 'Lener heeft nog een boek te laat',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var telaat = lopendeUitleningenVan(ctx.staat, ctx.lener.lenersnummer).filter(function (u) {
        return u.vervaldatum < ctx.vandaag;
      });
      if (!telaat.length) return null;
      var titels = telaat.map(function (u) {
        var b = boekVan(ctx.staat, u.boek_id);
        return '"' + (b ? b.titel : u.exemplaar) + '" (te laat sinds ' + datumTekst(u.vervaldatum, ctx.vandaag) + ')';
      });
      return 'Deze lener heeft nog een boek te laat: ' + titels.join(', ') + '.';
    }
  },
  {
    id: 'gereserveerd_voor_ander',
    naam: 'Exemplaar gereserveerd voor iemand anders',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var anderen = actieveReservaties(ctx.staat, ctx.boek.boek_id).filter(function (r) {
        if (String(r.lenersnummer) === String(ctx.lener.lenersnummer)) return false;
        // Een klaarliggende reservatie voor een ander exemplaar houdt dit exemplaar niet tegen.
        if (r.status === 'klaar om op te halen' && r.exemplaar && r.exemplaar !== ctx.exemplaar) return false;
        return true;
      });
      if (!anderen.length) return null;
      var r = anderen[0];
      return 'Dit boek is gereserveerd voor lener ' + lenerNaam(ctx.staat, r.lenersnummer) +
        ', sinds ' + datumTekst(r.datum_reservatie, ctx.vandaag) + '.';
    }
  },
  {
    id: 'max_verlengingen',
    naam: 'Maximum aantal verlengingen',
    actie: 'verlengen',
    controleer: function (ctx) {
      var aantal = Number(ctx.uitlening.aantal_verlengingen || 0);
      var max = ctx.inst.max_verlengingen;
      if (aantal < max) return null;
      return 'Dit boek is al ' + aantal + ' keer verlengd. Het maximum is ' + max + '.';
    }
  },
  {
    id: 'verlengen_bij_reservatie',
    naam: 'Verlengen terwijl iemand anders wacht',
    actie: 'verlengen',
    controleer: function (ctx) {
      if (!ctx.inst.verlengen_niet_bij_reservatie) return null;
      var wachtenden = actieveReservaties(ctx.staat, ctx.uitlening.boek_id).filter(function (r) {
        return String(r.lenersnummer) !== String(ctx.uitlening.lenersnummer);
      });
      if (!wachtenden.length) return null;
      var r = wachtenden[0];
      return 'Iemand anders wacht op dit boek: lener ' + lenerNaam(ctx.staat, r.lenersnummer) +
        ', sinds ' + datumTekst(r.datum_reservatie, ctx.vandaag) + '.' +
        (wachtenden.length > 1 ? ' Er wachten in totaal ' + wachtenden.length + ' mensen.' : '');
    }
  }
];

/** Lidwoorden die we negeren bij zoeken en vergelijken (Nederlands, Engels, Frans, Duits). */
var LIDWOORDEN = ['de', 'het', 'een', 'the', 'a', 'an', 'le', 'la', 'les', 'l', 'un', 'une', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'el', 'los', 'las'];

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
  ['tekst_welkom_en', 'Welcome to the catalogue of Project Madrigal, the queer library of Antwerp. Search, browse and come by to borrow.', 'Welkomsttekst in het Engels.'],
  ['tekst_uitleg_lenen_en', 'Borrowing is free, you only pay a 5 euro deposit per book. You get it back when you return the book. You can borrow 2 books at a time, for 4 weeks. Come by on Friday during opening hours.', 'Uitleg over lenen in het Engels.'],
  ['tekst_privacy_en', 'We only keep your first name, possibly your last name, your phone number and/or email address, and your borrower number. We only use them to follow up on your loans and to remind you when a book is due. Only the board can see your contact details. Twelve months after you return a book, we remove the link with you. Want to see your data or have it deleted? Ask at the desk or email [fill in the board email address].', 'Privacyverklaring in het Engels.'],
  ['adres', 'Peperfabriek (eerste verdieping)\nBreughelstraat 31\n2018 Antwerpen', 'Adres op de website. Een nieuwe regel maak je met Ctrl+Enter.'],
  ['openingsuren', 'Elke vrijdag: 18:00 - 20:00', 'Openingsuren op de website, in het Nederlands. Een nieuwe regel maak je met Ctrl+Enter.'],
  ['openingsuren_en', 'Every Friday: 18:00 - 20:00', 'Openingsuren op de website, in het Engels.'],
  ['mail_algemeen', 'info@projectmadrigal.be', 'Algemeen mailadres op de website.'],
  ['mail_events', 'events.madrigal@gmail.com', 'Mailadres voor events op de website.'],
  ['nieuw_op_startpagina_dagen', 60, 'Hoeveel dagen een nieuw toegevoegd boek bij de Aanraders op de startpagina staat, met het label "Nieuw binnen". 0: nieuwe boeken niet automatisch tonen.'],
  ['aanraders_verbergen', '', 'Namen van wie de aanraders niet op de startpagina staan, gescheiden door komma\'s (bv. Nance). Het label en de filter in de catalogus blijven. Leeg: iedereen staat erop.'],
  ['tekst_herinnering', 'Hoi {voornaam}, je leende bij Project Madrigal "{titel}". Dat boek moest terug op {vervaldatum}. Breng je het binnenkort binnen? Lukt dat niet, laat het ons dan even weten. Dank je!', 'Herinnering voor een boek dat te laat is. Gebruik {voornaam}, {titel} en {vervaldatum}.'],
  ['tekst_herinnering_binnenkort', 'Hoi {voornaam}, een vriendelijke herinnering: "{titel}" mag terug naar Project Madrigal op {vervaldatum}. Wil je het langer houden? Laat het ons weten, dan verlengen we het. Veel leesplezier!', 'Herinnering voor een boek dat binnenkort vervalt.']
];

var OL_PORTIE = 20;

var OL_PAUZE_MS = 1500;

var OL_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var OL_TALEN = { eng: 'Engels', dut: 'Nederlands', fre: 'Frans', ger: 'Duits', spa: 'Spaans', ita: 'Italiaans', por: 'Portugees' };

/** Velden die Open Library kan aanvullen. */
var OL_VELDEN = ['uitgeverij', 'jaartal', 'paginas', 'taal', 'beschrijving', 'cover_url'];

/** De kolommen van elk tabblad. De volgorde bepaalt enkel de opbouw bij installeren. */
var KOLOMMEN = {
  'Catalogus': [
    'boek_id', 'soort', 'titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas',
    'uitvoering', 'nieuwstaat', 'aanrader', 'genre', 'extra_onderwerpen', 'klassieker', 'aantal',
    'uitleenbaar', 'publiek', 'beschrijving', 'beschrijving_en', 'cover_url', 'startpagina', 'toegevoegd_op',
    // Vanaf hier: nooit publiek.
    'herkomst', 'isbn_origineel', 'bron_sleutel', 'ol_gecontroleerd', 'gb_gecontroleerd', 'beschrijving_gezocht', 'beschrijving_vertaald'
  ],
  'Onderwerpen': ['genre', 'filtergroepen', 'aantal_boeken'],
  'Leners': ['lenersnummer', 'voornaam', 'achternaam', 'telefoon', 'email', 'datum_inschrijving', 'toestemming_privacy', 'actief'],
  'Uitleningen': [
    'uitlening_id', 'exemplaar', 'boek_id', 'lenersnummer', 'datum_uit', 'oorspronkelijke_vervaldatum',
    'vervaldatum', 'datum_terug', 'aantal_verlengingen', 'datum_verlenging', 'borg', 'betaalwijze_borg',
    'borg_terugbetaald', 'gift', 'laatste_herinnering', 'vrijwilliger', 'bron'
  ],
  'Reservaties': [
    'reservatie_id', 'boek_id', 'lenersnummer', 'datum_reservatie', 'status', 'exemplaar',
    'datum_klaar', 'ophalen_tot', 'datum_afgesloten', 'vrijwilliger'
  ],
  'Uitzonderingen': ['datum', 'wie', 'grens', 'lenersnummer', 'boek_id', 'exemplaar', 'reden', 'actie'],
  'Na te kijken': ['datum', 'bron', 'boek_id', 'titel', 'veld', 'waarde_catalogus', 'waarde_bron', 'opmerking', 'afgehandeld', 'sleutel'],
  'Logboek': ['tijdstip', 'wie', 'actie', 'details'],
  // Inhoud van de website. Kolommen op _en zijn de Engelse versie (mag leeg: dan toont de site het Nederlands).
  'Nieuws': ['datum', 'titel', 'titel_en', 'tekst', 'tekst_en', 'afbeelding', 'link', 'publiek', 'bron_id'],
  'Agenda': ['datum', 'uur', 'titel', 'titel_en', 'tekst', 'tekst_en', 'locatie', 'afbeelding', 'link', 'publiek', 'bron_id'],
  'Veelgestelde vragen': ['volgorde', 'vraag', 'vraag_en', 'antwoord', 'antwoord_en', 'publiek', 'bron_id']
};

/** Kolommen met een datum. Die schrijven we als echte datum in de spreadsheet. */
var DATUMKOLOMMEN = [
  'datum_inschrijving', 'datum_uit', 'oorspronkelijke_vervaldatum', 'vervaldatum', 'datum_terug',
  'datum_verlenging', 'borg_terugbetaald', 'laatste_herinnering', 'datum_reservatie', 'datum_klaar',
  'ophalen_tot', 'datum_afgesloten', 'datum', 'ol_gecontroleerd', 'gb_gecontroleerd', 'toegevoegd_op', 'beschrijving_gezocht', 'beschrijving_vertaald'
];

var OUDE_SITE = 'https://www.projectmadrigal.be/';

var SITE_CACHE_SLEUTEL = 'site_v1';

var SITE_MAX_NIEUWS = 3;

var SITE_MAX_AANRADERS = 12;

var STATUS_WACHT = 'wacht';

var STATUS_KLAAR = 'klaar om op te halen';

var STATUS_AFGEHAALD = 'afgehaald';

var STATUS_VERVALLEN = 'vervallen';

var STATUS_GEANNULEERD = 'geannuleerd';

/* ---------- Opzoeken ---------- */

/* ==================== Functies, van A tot Z ==================== */

/** Aantal exemplaren van een boek (een leeg veld telt als 1). */
function aantalExemplaren(boek) {
  var n = parseerGetal(boek.aantal);
  return n && n > 0 ? Math.round(n) : 1;
}

/**
 * Achternaam uit "Achternaam, Voornaam" of "Voornaam Achternaam", genormaliseerd,
 * zonder tussenvoegsel.
 * Bij meerdere auteurs (gescheiden door ; of &) nemen we de eerste.
 */
function achternaam(auteur) {
  var eerste = schoon(auteur).split(/;|&| en | and /)[0];
  // "van Babylon, Dirk" en "Babylon, Dirk van" geven allebei "babylon":
  // we nemen het laatste woord, zodat tussenvoegsels geen rol spelen.
  var delen = normaliseerTekst(eerste.indexOf(',') > -1 ? eerste.split(',')[0] : eerste).split(' ');
  return delen[delen.length - 1] || '';
}

/** Reservaties die nog lopen (wacht of klaar), in volgorde van de wachtrij. */
function actieveReservaties(staat, boekId) {
  return staat.reservaties.filter(function (r) {
    return r.boek_id === boekId && (r.status === STATUS_WACHT || r.status === STATUS_KLAAR);
  }).sort(function (a, b) {
    return String(a.datum_reservatie).localeCompare(String(b.datum_reservatie)) ||
      String(a.reservatie_id).localeCompare(String(b.reservatie_id));
  });
}

/* ---------- Nummers ---------- */

/** Alle lopende reservaties, met hun plaats in de wachtrij. */
function alleReservaties(staat) {
  var perBoek = {};
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_WACHT || r.status === STATUS_KLAAR) perBoek[r.boek_id] = true;
  });
  var lijst = [];
  Object.keys(perBoek).forEach(function (boekId) {
    actieveReservaties(staat, boekId).forEach(function (r, i) { lijst.push(reservatieInfo(staat, r, i + 1)); });
  });
  return lijst;
}

/** Een reservatie annuleren. Lag het boek al klaar, dan gaat het naar de volgende. */
function annuleerReservatie(staat, invoer) {
  var r = reservatieVan(staat, invoer.reservatie_id);
  if (!r) return { ok: false, fout: 'Deze reservatie bestaat niet.' };
  if (r.status !== STATUS_WACHT && r.status !== STATUS_KLAAR) return { ok: false, fout: 'Deze reservatie is al afgesloten.' };
  var lag = r.status === STATUS_KLAAR ? r.exemplaar : '';
  wijzig(r, { status: STATUS_GEANNULEERD, datum_afgesloten: staat.vandaag });
  staat.log.push(['reservatie geannuleerd', r.reservatie_id]);
  var melding = lag ? geefExemplaarDoor(staat, r.boek_id, lag) : null;
  return { ok: true, tekst: 'Reservatie geannuleerd.' + (lag && !melding ? ' Het boek mag terug in de kast.' : ''), apartLeggen: melding ? [melding] : [] };
}

function apartLeggenMelding(staat, r) {
  return {
    reservatie_id: r.reservatie_id, exemplaar: r.exemplaar, lenersnummer: r.lenersnummer,
    tekst: 'Leg dit boek apart voor lener ' + lenerNaam(staat, r.lenersnummer),
    ophalen_tot: r.ophalen_tot,
    ophalenTekst: 'Ligt klaar tot en met ' + datumTekst(r.ophalen_tot, staat.vandaag)
  };
}

/** Korte lijst van alle boeken voor het uitleenscherm, ook de niet-publieke. */
function baliecatalogus(staat) {
  return staat.catalogus.filter(function (b) { return !isLeeg(b.boek_id) && !isLeeg(b.titel); }).map(function (b) {
    return {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), i: schoon(b.isbn),
      x: aantalExemplaren(b), u: jaNee(b.uitleenbaar) !== 'nee'
    };
  });
}

/** Gegevens voor het uitleenscherm. */
function balieGegevens(staat) {
  var lopend = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, false); });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  return {
    vandaag: staat.vandaag,
    vandaagTekst: datumTekst(staat.vandaag),
    instellingen: {
      borg_per_boek: staat.inst.borg_per_boek,
      borg_betaalwijzen: staat.inst.borg_betaalwijzen,
      gift_mogelijk: staat.inst.gift_mogelijk,
      max_boeken_per_lener: staat.inst.max_boeken_per_lener
    },
    privacy: staat.inst.tekst_privacy,
    boeken: baliecatalogus(staat),
    leners: staat.leners.filter(function (l) { return jaNee(l.actief) !== 'nee'; }).map(function (l) {
      return { n: l.lenersnummer, v: l.voornaam };
    }),
    lopend: lopend,
    reservaties: alleReservaties(staat)
  };
}

/** Bedrag: een getal van 0 tot 1000, afgerond op centen. Geeft null bij ongeldige invoer. */
function bedragInvoer(waarde) {
  if (isLeeg(waarde)) return 0;
  var n = parseerGetal(waarde);
  if (n === null || n < 0 || n > 1000) return null;
  return Math.round(n * 100) / 100;
}

function bedragTekst(n) {
  var b = Number(n || 0);
  return (b % 1 === 0 ? String(b) : b.toFixed(2).replace('.', ',')) + ' euro';
}

/**
 * Controleert de grenzen. Zijn er overschreden en is er geen reden opgegeven,
 * dan geeft dit het antwoord terug dat de schermen een reden moeten vragen.
 * Met een reden worden de uitzonderingen genoteerd en geeft dit null terug.
 */
function behandelGrenzen(staat, actie, ctx, invoer) {
  ctx.staat = staat;
  ctx.inst = staat.inst;
  ctx.vandaag = staat.vandaag;
  var overschreden = controleerGrenzen(actie, ctx);
  if (!overschreden.length) return null;
  var reden = invoer.uitzondering ? tekstInvoer(invoer.uitzondering.reden, 300) : '';
  if (reden.length < 3) return { ok: false, grenzen: overschreden };
  overschreden.forEach(function (g) {
    staat.uitzonderingen.push({
      datum: staat.vandaag, wie: staat.wie, grens: g.naam,
      lenersnummer: ctx.lener ? ctx.lener.lenersnummer : (ctx.uitlening ? ctx.uitlening.lenersnummer : ''),
      boek_id: ctx.boek ? ctx.boek.boek_id : '',
      exemplaar: ctx.exemplaar || (ctx.uitlening ? ctx.uitlening.exemplaar : ''),
      reden: reden, actie: actie
    });
  });
  return null;
}

/* ---------- Reservaties doorgeven ---------- */

/**
 * Tot wanneer ligt een gereserveerd boek apart?
 * Tot en met de zoveelste openingsdag na de dag waarop het boek klaarlag.
 */
function berekenOphaalTermijn(datumKlaar, inst) {
  var d = datumKlaar;
  for (var i = 0; i < Math.max(1, inst.ophaaltermijn_openingsdagen); i++) d = volgendeOpeningsdag(d, inst, false);
  return d;
}

/** Nieuwe vervaldatum na verlengen: huidige vervaldatum plus de verlengingstermijn. */
function berekenVerlenging(huidigeVervaldatum, inst) {
  var d = telDagenOp(huidigeVervaldatum, inst.verlengingstermijn_weken * 7);
  return inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(d, inst, true) : d;
}

/**
 * Vervaldatum van een nieuwe uitlening:
 * uitleendatum plus de uitleentermijn, opgeschoven naar de eerstvolgende openingsdag.
 */
function berekenVervaldatum(datumUit, inst) {
  var d = telDagenOp(datumUit, inst.uitleentermijn_weken * 7);
  return inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(d, inst, true) : d;
}

/**
 * Beschikbaarheid van een boek voor de publieke catalogus.
 * Geeft { code, label, totaal, beschikbaar, terug } terug. Nooit wie het boek heeft.
 *   code: 'beschikbaar', 'uitgeleend', 'gereserveerd' of 'niet_uitleenbaar'
 */
function beschikbaarheid(staat, boek) {
  var totaal = aantalExemplaren(boek);
  if (jaNee(boek.uitleenbaar) === 'nee') {
    var teKoop = normaliseerTekst(boek.genre) === 'verkoop';
    return { code: 'niet_uitleenbaar', label: teKoop ? 'Te koop in de bib, niet uitleenbaar' : 'Niet uitleenbaar', totaal: totaal, beschikbaar: 0, terug: '' };
  }
  var uit = lopendeUitleningen(staat).filter(function (u) { return u.boek_id === boek.boek_id; });
  var reservaties = actieveReservaties(staat, boek.boek_id);
  var apart = reservaties.filter(function (r) { return r.status === STATUS_KLAAR; }).length;
  var wacht = reservaties.length - apart;
  var vrij = Math.max(0, totaal - uit.length - apart);
  var terug = uit.map(function (u) { return u.vervaldatum; }).sort()[0] || '';
  if (vrij > 0) {
    return { code: 'beschikbaar', label: totaal > 1 ? vrij + ' van ' + totaal + ' beschikbaar' : 'Beschikbaar', totaal: totaal, beschikbaar: vrij, terug: '' };
  }
  if (apart > 0 || wacht > 0) {
    return { code: 'gereserveerd', label: 'Gereserveerd', totaal: totaal, beschikbaar: 0, terug: terug };
  }
  var label = terug && terug >= staat.vandaag ? 'Uitgeleend, verwacht terug op ' + datumTekst(terug, staat.vandaag) : 'Uitgeleend';
  return { code: 'uitgeleend', label: label, totaal: totaal, beschikbaar: 0, terug: terug };
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

/** Gegevens voor het bestuursscherm. */
function bestuurGegevens(staat, onderwerpRijen) {
  var lopend = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, true); });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  lopend.forEach(function (info) {
    var sjabloon = info.status.code === 'telaat' ? staat.inst.tekst_herinnering : staat.inst.tekst_herinnering_binnenkort;
    info.herinnering = herinneringTekst(sjabloon, info, staat);
  });

  // Borgen: ingehouden (borg betaald en nog niet terug) per betaalwijze.
  var ingehouden = { totaal: 0, perBetaalwijze: {} };
  var terugTeBetalen = [];
  staat.uitleningen.forEach(function (u) {
    var borg = Number(u.borg || 0);
    if (borg <= 0 || !isLeeg(u.borg_terugbetaald)) return;
    var wijze = u.betaalwijze_borg || 'onbekend';
    ingehouden.totaal += borg;
    ingehouden.perBetaalwijze[wijze] = (ingehouden.perBetaalwijze[wijze] || 0) + borg;
    // Boek is terug, maar de borg nog niet: die moet nog terugbetaald worden.
    if (!isLeeg(u.datum_terug)) {
      var info = uitleningInfo(staat, u, true);
      info.datum_terug = u.datum_terug;
      terugTeBetalen.push(info);
    }
  });

  // Giften en uitleningen per maand, voor de laatste 12 maanden.
  var vanaf = telMaandenOp(staat.vandaag, -11).slice(0, 7);
  var perMaand = {};
  for (var m = 0; m < 12; m++) {
    var sleutel = telMaandenOp(vanaf + '-01', m).slice(0, 7);
    perMaand[sleutel] = { maand: maandTekst(sleutel), uitleningen: 0, giften: 0 };
  }
  var perBoek = {}, perGroep = {};
  var vertaal = vertaalTabel(onderwerpRijen);
  staat.uitleningen.forEach(function (u) {
    var maand = String(u.datum_uit || '').slice(0, 7);
    if (perMaand[maand]) {
      perMaand[maand].uitleningen++;
      perMaand[maand].giften += Number(u.gift || 0);
    }
    perBoek[u.boek_id] = (perBoek[u.boek_id] || 0) + 1;
    var boek = boekVan(staat, u.boek_id);
    if (boek) filtergroepenVan(boek, vertaal).forEach(function (g) { perGroep[g] = (perGroep[g] || 0) + 1; });
  });
  var meestGeleend = Object.keys(perBoek).sort(function (a, b) { return perBoek[b] - perBoek[a]; }).slice(0, 10).map(function (id) {
    var b = boekVan(staat, id);
    return { boek_id: id, titel: b ? b.titel : id, auteur: b ? b.auteur : '', aantal: perBoek[id] };
  });
  var groepen = Object.keys(perGroep).sort(function (a, b) { return perGroep[b] - perGroep[a]; }).map(function (g) {
    return { groep: g, aantal: perGroep[g] };
  });

  // Uitzonderingen van de laatste 6 maanden, nieuwste eerst.
  var grens = telMaandenOp(staat.vandaag, -6);
  var uitzonderingen = (staat.uitzonderingenTabel || []).filter(function (x) { return String(x.datum) >= grens; }).map(function (x) {
    var b = boekVan(staat, x.boek_id);
    return {
      datum: x.datum, wie: x.wie, grens: x.grens, lenersnummer: x.lenersnummer,
      voornaam: (lenerVan(staat, x.lenersnummer) || {}).voornaam || '',
      titel: b ? b.titel : x.boek_id, reden: x.reden, actie: x.actie
    };
  }).sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });

  return {
    vandaag: staat.vandaag,
    vandaagTekst: datumTekst(staat.vandaag),
    telaat: lopend.filter(function (i) { return i.status.code === 'telaat'; }),
    binnenkort: lopend.filter(function (i) { return i.status.code === 'binnenkort'; }),
    lopend: lopend,
    borgen: {
      ingehouden: ingehouden,
      terugTeBetalen: terugTeBetalen
    },
    perMaand: Object.keys(perMaand).sort().map(function (k) { return perMaand[k]; }),
    meestGeleend: meestGeleend,
    groepen: groepen,
    reservaties: alleReservaties(staat),
    uitzonderingen: uitzonderingen,
    leners: staat.leners.map(function (l) {
      return {
        lenersnummer: l.lenersnummer, voornaam: l.voornaam, achternaam: l.achternaam, telefoon: l.telefoon,
        email: l.email, datum_inschrijving: l.datum_inschrijving, toestemming_privacy: l.toestemming_privacy,
        actief: jaNee(l.actief) !== 'nee',
        lopend: lopendeUitleningenVan(staat, l.lenersnummer).length
      };
    })
  };
}

/** Schrijft alle wijzigingen van een staat terug naar de spreadsheet. */
function bewaarStaat(staat) {
  ['Leners', 'Uitleningen', 'Reservaties', 'Uitzonderingen'].forEach(function (naam) {
    if (staat.tabellen[naam]) bewaarTabel(staat.tabellen[naam]);
  });
  if (staat.uitzonderingen.length) {
    var tabel = staat.tabellen.Uitzonderingen || leesTabel('Uitzonderingen');
    staat.uitzonderingen.forEach(function (x) { voegToe(tabel.rijen, x); });
    bewaarTabel(tabel);
  }
  staat.log.forEach(function (regel) { logboek(staat.wie, regel[0], regel[1]); });
}

/* ---------- Publiek eindpunt ---------- */

/**
 * Schrijft de wijzigingen van een tabel terug: gewijzigde rijen op hun plaats,
 * nieuwe rijen onderaan, te verwijderen rijen van onder naar boven.
 */
function bewaarTabel(tabel) {
  var blad = tabel.blad;
  var kop = tabel.kop;
  tabel.rijen.forEach(function (rij) {
    if (rij._gewijzigd && !rij._nieuw && !rij._verwijderen) {
      blad.getRange(rij._rij, 1, 1, kop.length).setValues([rijNaarWaarden(kop, rij)]);
      rij._gewijzigd = false;
    }
  });
  var nieuw = tabel.rijen.filter(function (r) { return r._nieuw; });
  if (nieuw.length) {
    var start = blad.getLastRow() + 1;
    blad.getRange(start, 1, nieuw.length, kop.length).setValues(nieuw.map(function (r) { return rijNaarWaarden(kop, r); }));
    nieuw.forEach(function (r, i) { r._nieuw = false; r._gewijzigd = false; r._rij = start + i; });
  }
  var weg = tabel.rijen.filter(function (r) { return r._verwijderen; }).map(function (r) { return r._rij; });
  weg.sort(function (a, b) { return b - a; }).forEach(function (rijnummer) { blad.deleteRow(rijnummer); });
  if (weg.length) tabel.rijen = tabel.rijen.filter(function (r) { return !r._verwijderen; });
}

/** Bij elke wijziging met de hand in Catalogus, Onderwerpen of Instellingen: cache leegmaken. */
function bijWijziging(e) {
  var naam = e && e.range ? e.range.getSheet().getName() : '';
  if (['Catalogus', 'Onderwerpen', 'Instellingen', 'Uitleningen', 'Reservaties', 'Nieuws', 'Agenda', 'Veelgestelde vragen'].indexOf(naam) > -1) leegCache();
}

function boekVan(staat, boekId) {
  var id = schoon(boekId).toUpperCase();
  for (var i = 0; i < staat.catalogus.length; i++) {
    if (String(staat.catalogus[i].boek_id).toUpperCase() === id) return staat.catalogus[i];
  }
  return null;
}

/** Bestuur: de borg van een uitlening als terugbetaald noteren. */
function borgTerugbetaald(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.borg_terugbetaald)) return { ok: false, fout: 'Deze borg is al terugbetaald.' };
  wijzig(u, { borg_terugbetaald: staat.vandaag });
  staat.log.push(['borg terugbetaald', u.uitlening_id]);
  return { ok: true, tekst: 'Borg genoteerd als terugbetaald.' };
}

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
      d: schoonMetRegels(rij.beschrijving), c: veiligeCoverUrl(rij.cover_url)
    };
    var en = schoonMetRegels(rij.beschrijving_en);
    if (en && en !== extra.d) extra.de = en;
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

/**
 * Bouwt de inhoud van de startpagina (zonder de spreadsheet aan te raken).
 * tabellen: { nieuws, agenda, faq } met de rijen van die tabbladen.
 * staat: zoals in Uitlenen.js (voor de aanraders en hun beschikbaarheid).
 */
function bouwSiteInhoud(staat, tabellen) {
  var inst = staat.inst;

  var nieuws = (tabellen.nieuws || []).filter(function (r) { return isPubliek(r) && (r.titel || r.tekst); })
    .sort(function (a, b) { return String(b.datum || '').localeCompare(String(a.datum || '')); })
    .slice(0, SITE_MAX_NIEUWS)
    .map(function (r) {
      return { datum: parseerDatum(r.datum), titel: tweetalig(r, 'titel'), tekst: tweetaligLang(r, 'tekst'), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link) };
    });

  var events = (tabellen.agenda || []).filter(function (r) { return isPubliek(r) && parseerDatum(r.datum) && r.titel; })
    .map(function (r) {
      return {
        datum: parseerDatum(r.datum), uur: schoon(r.uur), titel: tweetalig(r, 'titel'), tekst: tweetaligLang(r, 'tekst'),
        locatie: schoon(r.locatie), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link)
      };
    });
  var komend = events.filter(function (e) { return e.datum >= staat.vandaag; }).sort(function (a, b) { return a.datum.localeCompare(b.datum); });
  var voorbij = events.filter(function (e) { return e.datum < staat.vandaag; }).sort(function (a, b) { return b.datum.localeCompare(a.datum); });

  var faq = (tabellen.faq || []).filter(function (r) { return isPubliek(r) && r.vraag; })
    .sort(function (a, b) { return (parseerGetal(a.volgorde) || 999) - (parseerGetal(b.volgorde) || 999); })
    .map(function (r) { return { vraag: tweetalig(r, 'vraag'), antwoord: tweetaligLang(r, 'antwoord') }; });

  // Aanraders op de startpagina. Een boek staat erop als:
  //   - de kolom startpagina "ja" is, of
  //   - iemand het aanraadt (namen uit aanraders_verbergen tellen niet mee), of
  //   - het nieuw binnen is: toegevoegd_op ligt minder dan nieuw_op_startpagina_dagen geleden.
  // "nee" in de kolom startpagina haalt een boek er altijd af.
  // Beschikbare boeken eerst, daarna willekeurig maar vast per dag.
  var verborgen = splitsLijst(inst.aanraders_verbergen).map(normaliseerTekst);
  var dagenNieuw = parseerGetal(inst.nieuw_op_startpagina_dagen);
  if (dagenNieuw === null) dagenNieuw = 60;
  var isNieuw = function (b) {
    var d = parseerDatum(b.toegevoegd_op);
    if (!d || dagenNieuw <= 0) return false;
    var dagen = dagenTussen(d, staat.vandaag);
    return dagen >= 0 && dagen < dagenNieuw;
  };
  var aanraders = staat.catalogus.filter(function (b) {
    return !isLeeg(b.boek_id) && jaNee(b.publiek) !== 'nee' && jaNee(b.startpagina) !== 'nee';
  }).map(function (b) {
    var bs = beschikbaarheid(staat, b);
    return {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), c: veiligeCoverUrl(b.cover_url),
      s: normaliseerTekst(b.soort) === 'zine' ? 'zine' : 'boek',
      r: splitsLijst(String(b.aanrader || '').replace(/ en | & /g, ',')).filter(function (naam) {
        return verborgen.indexOf(normaliseerTekst(naam)) === -1;
      }),
      n: isNieuw(b) ? 1 : 0,
      zelf: jaNee(b.startpagina) === 'ja',
      vrij: bs.code === 'beschikbaar',
      volgorde: dagVolgorde(String(b.boek_id), staat.vandaag)
    };
  }).filter(function (b) { return b.zelf || b.r.length || b.n; }).sort(function (a, b) { return (b.vrij - a.vrij) || (a.volgorde - b.volgorde); })
    .slice(0, SITE_MAX_AANRADERS)
    .map(function (b) { delete b.volgorde; delete b.zelf; return b; });

  return {
    bijgewerkt: staat.vandaag,
    contact: {
      adres: String(inst.adres || ''), openingsuren: { nl: String(inst.openingsuren || ''), en: String(inst.openingsuren_en || '') || String(inst.openingsuren || '') },
      mail_algemeen: inst.mail_algemeen, mail_events: inst.mail_events
    },
    nieuws: nieuws,
    agenda: { komend: komend.slice(0, 3), vorig: voorbij[0] || null },
    faq: faq,
    aanraders: aanraders
  };
}

/**
 * Sleutel om hetzelfde boek te herkennen: het ISBN, of anders de volledige titel en auteur.
 * Een boek zonder geldig ISBN maar met een ongeldig nummer, gebruikt titel en auteur.
 */
function bronSleutel(boek) {
  if (boek.isbn) return boek.soort + ':isbn:' + boek.isbn;
  // De volledige titel: "Ember: Macht (derde editie)" en "Ember: Bubbels (tweede editie)"
  // zijn verschillende boeken. Enkel hoofdletters, accenten en leestekens tellen niet.
  return boek.soort + ':ta:' + normaliseerTekst(boek.titel) + '|' + normaliseerTekst(boek.auteur);
}

/** Zet een waarde om naar wat we in een cel schrijven. */
function celWaarde(kolom, waarde) {
  if (waarde === undefined || waarde === null) return '';
  if (DATUMKOLOMMEN.indexOf(kolom) > -1 && typeof waarde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(waarde)) {
    var d = waarde.split('-');
    // Middag, zodat zomer- en wintertijd de dag niet doen verspringen.
    return new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]), 12);
  }
  return veiligeCel(waarde);
}

/**
 * Controleert alle grenzen van een actie.
 * Geeft een lijst terug met de overschreden grenzen: [{ id, naam, melding }].
 */
function controleerGrenzen(actie, ctx) {
  var overschreden = [];
  GRENZEN.forEach(function (g) {
    if (g.actie !== actie) return;
    var melding = g.controleer(ctx);
    if (melding) overschreden.push({ id: g.id, naam: g.naam, melding: melding });
  });
  return overschreden;
}

/** "1 dag" of "5 dagen". */
function dagenTekst(n) {
  return n + (n === 1 ? ' dag' : ' dagen');
}

/** Aantal dagen van datum a tot datum b (positief als b later is). */
function dagenTussen(a, b) {
  return Math.round((naarUtc(b) - naarUtc(a)) / 86400000);
}

/** Een getal dat per boek en per dag anders is: zo wisselen de aanraders elke dag. */
function dagVolgorde(id, dag) {
  var tekst = id + dag;
  var h = 0;
  for (var i = 0; i < tekst.length; i++) h = (h * 31 + tekst.charCodeAt(i)) % 1000003;
  return h;
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

/** GET: de publieke catalogus. */
function doGet(e) {
  var actie = e && e.parameter ? e.parameter.actie : '';
  if (actie === 'catalogus') return json(publiekeCatalogusJson(), true);
  if (actie === 'site') return json(siteInhoudJson(), true);
  return json(JSON.stringify({ ok: true, info: 'Catalogus Project Madrigal. Gebruik ?actie=catalogus.' }), true);
}

/** POST: acties voor de balie en het bestuur. */
function doPost(e) {
  var invoer;
  try {
    invoer = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, fout: 'Ongeldig verzoek.' });
  }
  if (!invoer || typeof invoer !== 'object') return json({ ok: false, fout: 'Ongeldig verzoek.' });
  var actie = String(invoer.actie || '');
  if (!ACTIES.hasOwnProperty(actie)) return json({ ok: false, fout: 'Onbekende actie.' });

  var rol = rolVoorCode(invoer.code, leesInstellingen());
  if (!rol) {
    // Even wachten maakt het raden van codes trager.
    Utilities.sleep(1500);
    return json({ ok: false, fout: 'De code klopt niet.', code: 'ongeldige_code' });
  }
  if (ACTIES[actie] === 'bestuur' && rol !== 'bestuur') {
    return json({ ok: false, fout: 'Dit kan enkel met de code van het bestuur.' });
  }

  try {
    return json(voerActieUit(actie, invoer, rol));
  } catch (err) {
    logboek('systeem', 'fout', actie + ': ' + String(err && err.message || err).slice(0, 200));
    return json({ ok: false, fout: 'Er ging iets mis: ' + String(err && err.message || err) });
  }
}

/** De eerste niet-lege waarde uit een lijst mogelijke veldnamen. */
function eersteVeld(rij, namen) {
  for (var i = 0; i < namen.length; i++) {
    var w = rij[namen[i]];
    if (w !== undefined && w !== null && String(w).trim() !== '') return w;
  }
  return '';
}

/** Zoekt boek en exemplaar bij een exemplaarnummer. "B0012" mag ook als er maar één exemplaar is. */
function exemplaarInfo(staat, exemplaar) {
  var t = schoon(exemplaar).toUpperCase();
  var m = t.match(/^([A-Z]\d+)(?:-(\d+))?$/);
  if (!m) return null;
  var boek = boekVan(staat, m[1]);
  if (!boek) return null;
  var nr = m[2] ? Number(m[2]) : 1;
  if (nr < 1 || nr > aantalExemplaren(boek)) return null;
  return { boek: boek, exemplaar: boek.boek_id + '-' + nr };
}

/** Alle exemplaarnummers van een boek: ["B0012-1", "B0012-2"]. */
function exemplarenVan(boek) {
  var lijst = [];
  for (var i = 1; i <= aantalExemplaren(boek); i++) lijst.push(boek.boek_id + '-' + i);
  return lijst;
}

/**
 * Bepaalt de filtergroepen van een boek: via de vertaaltabel, de kolom
 * extra_onderwerpen, het vinkje klassieker en de soort (zines).
 * vertaal: object genre (genormaliseerd) -> lijst filtergroepen.
 */
function filtergroepenVan(boek, vertaal) {
  var groepen = (vertaal[normaliseerTekst(boek.genre)] || []).slice();
  splitsLijst(boek.extra_onderwerpen).forEach(function (g) { groepen.push(g); });
  if (jaNee(boek.klassieker) === 'ja') groepen.push('Klassiekers');
  if (normaliseerTekst(boek.soort) === 'zine') groepen.push('Zines');
  // Schrijfwijze gelijktrekken met de standaardgroepen, dubbels weg.
  var uniek = [];
  groepen.forEach(function (g) {
    var standaard = FILTERGROEPEN.filter(function (f) { return normaliseerTekst(f) === normaliseerTekst(g); })[0] || schoon(g);
    if (standaard && uniek.indexOf(standaard) === -1) uniek.push(standaard);
  });
  return uniek;
}

/**
 * Een exemplaar komt vrij (teruggebracht, reservatie vervallen of geannuleerd).
 * Wacht er iemand op dit boek, dan krijgt de eerste in de wachtrij dit exemplaar.
 * Geeft de melding voor de vrijwilliger terug, of null.
 */
function geefExemplaarDoor(staat, boekId, exemplaar) {
  var wachtend = actieveReservaties(staat, boekId).filter(function (r) { return r.status === STATUS_WACHT; });
  if (!wachtend.length) return null;
  var r = wachtend[0];
  wijzig(r, {
    status: STATUS_KLAAR, exemplaar: exemplaar, datum_klaar: staat.vandaag,
    ophalen_tot: berekenOphaalTermijn(staat.vandaag, staat.inst)
  });
  staat.log.push(['reservatie klaar', r.reservatie_id + ' ' + exemplaar + ' voor lener ' + r.lenersnummer]);
  return apartLeggenMelding(staat, r);
}

/** Hulp voor parseerDatum: controleert of dag en maand bestaan. */
function geldigeDatum(jaar, maand, dag) {
  var d = new Date(Date.UTC(jaar, maand - 1, dag));
  if (d.getUTCFullYear() !== jaar || d.getUTCMonth() !== maand - 1 || d.getUTCDate() !== dag) return '';
  return jaar + '-' + tweeCijfers(maand) + '-' + tweeCijfers(dag);
}

function geldigEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Telefoonnummer: cijfers, spaties, +, /, . en - ; minstens 8 cijfers. */
function geldigeTelefoon(t) {
  return /^[+0-9 ()\/.\-]{8,25}$/.test(t) && t.replace(/\D/g, '').length >= 8;
}

/** Gelijkenis tussen twee teksten, van 0 (niets gemeen) tot 1 (gelijk). */
function gelijkenis(a, b) {
  if (!a && !b) return 1;
  var max = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / max;
}

/** Goodreads zet ISBN's als ="0123456789". Dit haalt die tekens weg. */
function goodreadsIsbn(waarde) {
  return normaliseerIsbn(String(waarde || '').replace(/[="]/g, '')).isbn;
}

/** De eerste niet-lege waarde uit een lijst Goodreads-kolommen. */
function goodreadsWaarde(rij, kolommen) {
  for (var i = 0; i < kolommen.length; i++) {
    var w = rij[kolommen[i]];
    if (!isLeeg(w) && String(w).trim() !== '0') return w;
  }
  return '';
}

/** Haalt JSON op. Geeft { code, data } terug. */
function haalJson(url) {
  var antwoord = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT } });
  var data = null;
  try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = null; }
  return { code: antwoord.getResponseCode(), data: data };
}

/** Haalt een tabel op uit de oude databank. Geeft [] als die niet bestaat. */
function haalOudeTabel(db, tabel) {
  var antwoord = UrlFetchApp.fetch(db.url + '/rest/v1/' + tabel + '?select=*', {
    muteHttpExceptions: true,
    headers: { apikey: db.sleutel, Authorization: 'Bearer ' + db.sleutel }
  });
  if (antwoord.getResponseCode() !== 200) return [];
  try { return JSON.parse(antwoord.getContentText()) || []; } catch (e) { return []; }
}

/** Moet het script voor dit boek nog een beschrijving zoeken? */
function heeftBeschrijvingNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.beschrijving_gezocht)) return false;
  return isLeeg(boek.beschrijving);
}

/** Heeft dit boek nog een cover nodig van Google Books? */
function heeftGoogleBooksNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.gb_gecontroleerd)) return false;
  return isLeeg(boek.cover_url);
}

/** Heeft dit boek nog iets nodig van Open Library? */
function heeftOpenLibraryNodig(boek) {
  var isbn = String(boek.isbn || '');
  if (!/^\d{13}$/.test(isbn)) return false;
  if (!isLeeg(boek.ol_gecontroleerd)) return false;
  return OL_VELDEN.some(function (v) { return isLeeg(boek[v]); });
}

/** Moet deze beschrijving nog vertaald worden? */
function heeftVertalingNodig(boek) {
  return !isLeeg(boek.beschrijving) && isLeeg(boek.beschrijving_vertaald);
}

/**
 * Menu: wist de Catalogus en bouwt ze opnieuw op uit Stock en Zines.
 * Enkel bedoeld voor de eerste opbouw. Wat je met de hand in de Catalogus
 * aanpaste, gaat verloren. Het script weigert zodra er uitleningen of
 * reservaties zijn, want die verwijzen naar de boek-ID's.
 */
function herbouwCatalogus() {
  if (leesTabel('Uitleningen').rijen.length || leesTabel('Reservaties').rijen.length) {
    meld('De Catalogus opnieuw opbouwen kan niet meer: er zijn al uitleningen of reservaties. Die verwijzen naar de boek-ID\'s.');
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var antwoord = ui.alert('Catalogus opnieuw opbouwen',
    'Dit wist alle boeken in het tabblad Catalogus, ook wat je er met de hand aanpaste, en bouwt ze opnieuw op uit Stock en Zines. De boek-ID\'s beginnen opnieuw bij B0001. Doorgaan?',
    ui.ButtonSet.YES_NO);
  if (antwoord !== ui.Button.YES) return;
  var blad = spreadsheet().getSheetByName('Catalogus');
  if (blad.getLastRow() > 1) blad.getRange(2, 1, blad.getLastRow() - 1, blad.getLastColumn()).clearContent();
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('teller_boek_B');
  props.deleteProperty('teller_boek_Z');
  logboek('menu', 'herbouwCatalogus', 'Catalogus gewist');
  maakCatalogus();
}

/** Vult de herinneringstekst in voor een uitlening. */
function herinneringTekst(sjabloon, info, staat) {
  return String(sjabloon || '')
    .replace(/\{voornaam\}/g, info.voornaam || '')
    .replace(/\{titel\}/g, info.titel || '')
    .replace(/\{vervaldatum\}/g, datumTekst(info.vervaldatum, staat.vandaag));
}

/** Bestuur: noteren dat een herinnering verstuurd werd. */
function herinneringVerstuurd(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  wijzig(u, { laatste_herinnering: staat.vandaag });
  staat.log.push(['herinnering verstuurd', u.uitlening_id]);
  return { ok: true, tekst: 'Herinnering genoteerd op ' + korteDatum(staat.vandaag) + '.' };
}

/** HTML uit de oude databank naar gewone tekst met regeleinden. */
function htmlNaarTekst(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Menu: neemt nieuws, agenda en veelgestelde vragen over van de oude website. */
function importeerOudeSite() {
  installeer(); // zorgt dat de tabbladen Nieuws, Agenda en Veelgestelde vragen bestaan
  var db = vindOudeDatabank();
  var posts = haalOudeTabel(db, 'posts');
  if (!posts.length) posts = haalOudeTabel(db, 'view_posts');
  var events = haalOudeTabel(db, 'events');
  var faq = haalOudeTabel(db, 'faq');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var tellers = {};
  try {
    [['Nieuws', zetOudeNieuwsOm(posts, db.url)], ['Agenda', zetOudeEventsOm(events, db.url)], ['Veelgestelde vragen', zetOudeFaqOm(faq)]].forEach(function (paar) {
      var tabel = leesTabel(paar[0]);
      tellers[paar[0]] = voegOudeRijenToe(tabel.rijen, paar[1]);
      bewaarTabel(tabel);
    });
  } finally {
    lock.releaseLock();
  }
  leegCache();
  // Welke velden de oude databank had: handig als er iets ontbreekt.
  var velden = function (rijen) { return rijen.length ? Object.keys(rijen[0]).join(', ') : '(leeg)'; };
  logboek('menu', 'importeerOudeSite', 'nieuws: ' + velden(posts) + ' | events: ' + velden(events) + ' | faq: ' + velden(faq));
  meld('Overgenomen van de oude website: ' + tellers['Nieuws'] + ' nieuwsberichten, ' + tellers['Agenda'] + ' events en ' +
    tellers['Veelgestelde vragen'] + ' veelgestelde vragen. Kijk ze na in de tabbladen. De Engelse kolommen vul je zelf aan waar nodig.');
}

/**
 * Menu: maakt de nieuwe tabbladen aan. Bestaande tabbladen en gegevens blijven
 * staan: enkel ontbrekende tabbladen, kolommen en instellingen komen erbij.
 */
function installeer() {
  var ss = spreadsheet();

  // Instellingen: sleutel, waarde, uitleg.
  var inst = ss.getSheetByName('Instellingen') || ss.insertSheet('Instellingen');
  if (inst.getLastRow() === 0) {
    inst.appendRow(['sleutel', 'waarde', 'uitleg']);
    opmaakKop(inst, 3);
  }
  var bestaand = {};
  inst.getDataRange().getValues().slice(1).forEach(function (r) { bestaand[schoon(r[0])] = r[1]; });
  STANDAARD_INSTELLINGEN.forEach(function (rij) {
    if (bestaand.hasOwnProperty(rij[0])) {
      // Een lege code vullen we in met een willekeurige code.
      if ((rij[0] === 'toegangscode_balie' || rij[0] === 'code_bestuur') && isLeeg(bestaand[rij[0]])) {
        zetInstelling(inst, rij[0], willekeurigeCode());
      }
      return;
    }
    var waarde = rij[1];
    if (rij[0] === 'toegangscode_balie' || rij[0] === 'code_bestuur') waarde = willekeurigeCode();
    inst.appendRow([rij[0], waarde, rij[2]]);
  });
  inst.setColumnWidth(1, 280);
  inst.setColumnWidth(2, 380);
  inst.setColumnWidth(3, 480);
  inst.getRange(1, 2, inst.getLastRow(), 2).setWrap(true);

  // De andere tabbladen met hun kolommen.
  Object.keys(KOLOMMEN).forEach(function (naam) {
    var blad = ss.getSheetByName(naam) || ss.insertSheet(naam);
    var kolommen = KOLOMMEN[naam];
    var kop = blad.getLastRow() > 0 ? blad.getRange(1, 1, 1, Math.max(1, blad.getLastColumn())).getValues()[0].map(schoon) : [];
    var ontbrekend = kolommen.filter(function (k) { return kop.indexOf(k) === -1; });
    if (ontbrekend.length) {
      var start = blad.getLastColumn() + 1;
      if (!kop.some(function (k) { return k; })) start = 1;
      blad.getRange(1, start, 1, ontbrekend.length).setValues([ontbrekend]);
    }
    opmaakKop(blad, blad.getLastColumn());
  });

  // Tekstopmaak voor kolommen die tekst moeten blijven (ISBN, telefoon, lenersnummer).
  zetTekstopmaak(ss.getSheetByName('Catalogus'), ['isbn', 'boek_id']);
  zetTekstopmaak(ss.getSheetByName('Leners'), ['telefoon']);

  // Niet-publieke kolommen van de Catalogus grijs markeren.
  var cat = ss.getSheetByName('Catalogus');
  var catKop = cat.getRange(1, 1, 1, cat.getLastColumn()).getValues()[0].map(schoon);
  ['herkomst', 'isbn_origineel', 'bron_sleutel', 'ol_gecontroleerd', 'gb_gecontroleerd', 'beschrijving_gezocht', 'beschrijving_vertaald'].forEach(function (k) {
    var i = catKop.indexOf(k);
    if (i > -1) {
      cat.getRange(1, i + 1).setBackground('#d9d9d9').setNote('Niet publiek. Deze kolom verschijnt nooit op de website.');
    }
  });

  // Planning: elke nacht de privacy-opruiming, en de cache legen bij een wijziging.
  verwijderTriggers('ruimOp');
  verwijderTriggers('bijWijziging');
  ScriptApp.newTrigger('ruimOp').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('bijWijziging').forSpreadsheet(ss).onEdit().create();

  logboek('menu', 'installeer', 'tabbladen klaar');
  meld('De tabbladen staan klaar. Kijk in Instellingen de codes en teksten na.');
}

/** Controleert het controlecijfer van een ISBN-10 (10 tekens, laatste mag X zijn). */
function isbn10Geldig(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  var som = 0;
  for (var i = 0; i < 10; i++) {
    var c = isbn.charAt(i);
    som += (c === 'X' ? 10 : Number(c)) * (10 - i);
  }
  return som % 11 === 0;
}

/** Zet een (geldig) ISBN-10 om naar ISBN-13: 978 ervoor en een nieuw controlecijfer. */
function isbn10Naar13(isbn10) {
  var basis = '978' + isbn10.slice(0, 9);
  var som = 0;
  for (var i = 0; i < 12; i++) som += Number(basis.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return basis + ((10 - (som % 10)) % 10);
}

/** Controleert het controlecijfer van een ISBN-13. */
function isbn13Geldig(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  var som = 0;
  for (var i = 0; i < 12; i++) som += Number(isbn.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return (10 - (som % 10)) % 10 === Number(isbn.charAt(12));
}

/** Is dit een Date-object (zoals de spreadsheet datums teruggeeft)? */
function isDatumObject(waarde) {
  return Object.prototype.toString.call(waarde) === '[object Date]' && !isNaN(waarde.getTime());
}

/** Geeft true als een waarde leeg is (niets, lege tekst of enkel spaties). */
function isLeeg(waarde) {
  return waarde === null || waarde === undefined || String(waarde).trim() === '';
}

/** Is de bib open op deze datum? Juiste weekdag en niet in gesloten_data. */
function isOpeningsdag(datum, inst) {
  return inst.openingsdagen.indexOf(weekdag(datum)) > -1 && inst.gesloten_data.indexOf(datum) === -1;
}

function isPubliek(rij) {
  return jaNee(rij.publiek) !== 'nee';
}

/** Maakt ja/nee eenvormig. Geeft 'ja', 'nee' of '' terug. */
function jaNee(waarde) {
  if (waarde === true) return 'ja';
  if (waarde === false) return 'nee';
  var t = normaliseerTekst(waarde);
  if (['ja', 'j', 'yes', 'y', 'waar', 'true', 'x', '1'].indexOf(t) > -1) return 'ja';
  if (['nee', 'n', 'no', 'onwaar', 'false', '0'].indexOf(t) > -1) return 'nee';
  return '';
}

/** Een JSON-antwoord. */
function json(tekst) {
  return ContentService.createTextOutput(typeof tekst === 'string' ? tekst : JSON.stringify(tekst))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Afgeschermde eindpunten ---------- */

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
    if (!g) g = opTitelAuteur[t + '|' + achternaam(boek.auteur)];
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

/** Korte datum: "20/11/2026". */
function korteDatum(datum) {
  if (!datum) return '';
  var d = datum.split('-');
  return Number(d[2]) + '/' + Number(d[1]) + '/' + d[0];
}

/**
 * Leest alle gegevens die de uitleenlogica nodig heeft.
 * wie: voornaam van de vrijwilliger (voor het logboek en de uitzonderingen).
 */
function laadStaat(wie, metUitzonderingen) {
  var tabellen = {
    Catalogus: leesTabel('Catalogus'),
    Leners: leesTabel('Leners'),
    Uitleningen: leesTabel('Uitleningen'),
    Reservaties: leesTabel('Reservaties')
  };
  if (metUitzonderingen) tabellen.Uitzonderingen = leesTabel('Uitzonderingen');
  // Getallen uit de spreadsheet (lenersnummer 12.0) gelijk maken aan tekst ("12").
  tabellen.Leners.rijen.forEach(function (l) { l.lenersnummer = String(l.lenersnummer); });
  tabellen.Uitleningen.rijen.forEach(function (u) { if (!isLeeg(u.lenersnummer)) u.lenersnummer = String(u.lenersnummer); });
  tabellen.Reservaties.rijen.forEach(function (r) { if (!isLeeg(r.lenersnummer)) r.lenersnummer = String(r.lenersnummer); });
  return {
    tabellen: tabellen,
    inst: leesInstellingen(),
    vandaag: vandaagTekst(),
    wie: tekstInvoer(wie, 40) || 'onbekend',
    catalogus: tabellen.Catalogus.rijen,
    leners: tabellen.Leners.rijen,
    uitleningen: tabellen.Uitleningen.rijen,
    reservaties: tabellen.Reservaties.rijen,
    uitzonderingenTabel: tabellen.Uitzonderingen ? tabellen.Uitzonderingen.rijen : [],
    uitzonderingen: [],
    log: [],
    nieuwNummer: function (soort, bestaande) { return volgendNummer(soort, bestaande); }
  };
}

/** Maakt de cache van de publieke catalogus leeg, zodat de volgende opvraging vers is. */
function leegCache() {
  try { CacheService.getScriptCache().removeAll([CACHE_SLEUTEL + '_n', SITE_CACHE_SLEUTEL]); } catch (e) { /* niets aan de hand */ }
}

/** Leest de borg uit tekst als "5 cash", "€5 QR" of "QR". */
function leesBorg(waarde, inst) {
  var bedrag = parseerGetal(waarde);
  var t = normaliseerTekst(waarde);
  var wijze = '';
  inst.borg_betaalwijzen.forEach(function (w) { if (t.indexOf(normaliseerTekst(w)) > -1) wijze = w; });
  if (bedrag === null && wijze) bedrag = inst.borg_per_boek;
  return { bedrag: bedrag || 0, betaalwijze: wijze };
}

/**
 * Zet de ruwe waarden van een tabblad (Stock of Zines) om naar boek-objecten.
 * waarden: tweedimensionale lijst zoals getValues() ze teruggeeft.
 * soort: 'boek' of 'zine'.
 * Lege rijen en herhaalde kopregels slaan we over.
 */
function leesBronRijen(waarden, soort) {
  // Zoek de kopregel: de eerste rij met een cel "Titel".
  var kopIndex = -1;
  for (var r = 0; r < Math.min(waarden.length, 20); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'titel'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(function (c) { return normaliseerTekst(c); });
  var kolom = {};
  var laatsteBenoemde = -1;
  kop.forEach(function (k, i) {
    var veld = BRONKOLOMMEN[k];
    if (veld && kolom[veld] === undefined) { kolom[veld] = i; laatsteBenoemde = Math.max(laatsteBenoemde, i); }
  });
  // De herkomst staat in de eerste kolom zonder kop, rechts van de benoemde kolommen.
  var herkomstKolom = -1;
  for (var c = laatsteBenoemde + 1; c < kop.length + 5; c++) {
    if (kop[c]) continue;
    var heeftData = waarden.slice(kopIndex + 1).some(function (rij) { return !isLeeg(rij[c]); });
    if (heeftData) { herkomstKolom = c; break; }
  }

  var boeken = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var titel = schoon(rij[kolom.titel]);
    if (!titel || normaliseerTekst(titel) === 'titel') continue; // lege rij of herhaalde kop
    var lees = function (veld) { return kolom[veld] === undefined ? '' : rij[kolom[veld]]; };
    var isbnRuw = lees('isbn');
    var isbn = normaliseerIsbn(isbnRuw);
    var aantal = parseerGetal(lees('aantal'));
    var jaar = parseerGetal(lees('jaartal'));
    var paginas = parseerGetal(lees('paginas'));
    boeken.push({
      soort: soort,
      titel: titel,
      auteur: schoon(lees('auteur')),
      isbn: isbn.isbn || isbn.issn,
      isbn_origineel: isbn.geldig || isbn.leeg ? '' : schoon(isbnRuw),
      uitgeverij: schoon(lees('uitgeverij')),
      jaartal: jaar ? Math.round(jaar) : '',
      taal: normaliseerTaal(lees('taal')),
      paginas: paginas ? Math.round(paginas) : '',
      uitvoering: normaliseerUitvoering(lees('uitvoering')),
      nieuwstaat: jaNee(lees('nieuwstaat')),
      aanrader: schoon(lees('aanrader')),
      genre: schoon(lees('genre')),
      aantal: aantal && aantal > 0 ? Math.round(aantal) : 1,
      herkomst: herkomstKolom > -1 ? schoon(rij[herkomstKolom]) : ''
    });
  }
  return boeken;
}

/**
 * Zet de ruwe waarden van het tabblad Goodreads-export om naar objecten.
 * shelf: (optioneel) enkel boeken op deze shelf. De export bevat je volledige
 * bibliotheek; de kolommen "Bookshelves" en "Exclusive Shelf" zeggen op welke
 * shelves een boek staat.
 */
function leesGoodreadsRijen(waarden, shelf) {
  if (!waarden.length) return [];
  var kop = waarden[0].map(schoon);
  var gezocht = normaliseerTekst(shelf);
  return waarden.slice(1).map(function (rij) {
    var obj = {};
    kop.forEach(function (k, i) { if (k) obj[k] = rij[i]; });
    return obj;
  }).filter(function (o) {
    if (isLeeg(o.Title)) return false;
    if (!gezocht) return true;
    var shelves = splitsLijst(o.Bookshelves).concat([schoon(o['Exclusive Shelf'])]);
    return shelves.some(function (s) { return normaliseerTekst(s) === gezocht; });
  });
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

/** Zet de waarden van het oude blad om naar objecten met vaste namen. */
function leesOudeUitleningen(waarden) {
  var kopIndex = -1;
  for (var r = 0; r < Math.min(10, waarden.length); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'boek'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(normaliseerTekst);
  var k = {
    boek: oudeKolom(kop, 'boek'), auteur: oudeKolom(kop, 'auteur'), voornaam: oudeKolom(kop, 'voornaam'),
    achternaam: oudeKolom(kop, 'achternaam'), telefoon: oudeKolom(kop, 'telefoon'), email: oudeKolom(kop, 'e mail') > -1 ? oudeKolom(kop, 'e mail') : oudeKolom(kop, 'email'),
    datum_uit: oudeKolom(kop, 'datum ontlening'), datum_terug_afgesproken: oudeKolom(kop, 'datum terug'),
    borg: oudeKolom(kop, 'borg'), gift: oudeKolom(kop, 'gift'), herinnering: oudeKolom(kop, 'reminder'),
    terug_op: oudeKolom(kop, 'boek terug op')
  };
  var rijen = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var lees = function (naam) { return k[naam] > -1 ? rij[k[naam]] : ''; };
    if (isLeeg(lees('boek'))) continue;
    rijen.push({
      rijnummer: i + 1,
      boek: schoon(lees('boek')), auteur: schoon(lees('auteur')),
      voornaam: schoon(lees('voornaam')), achternaam: schoon(lees('achternaam')),
      telefoon: schoon(lees('telefoon')), email: schoon(lees('email')).toLowerCase(),
      datum_uit: parseerDatum(lees('datum_uit')), datum_terug_afgesproken: parseerDatum(lees('datum_terug_afgesproken')),
      borg: lees('borg'), gift: lees('gift'), herinnering: lees('herinnering'),
      terug_op: lees('terug_op')
    });
  }
  return rijen;
}

/**
 * Leest een tabblad in.
 * Geeft { naam, blad, kop, rijen } terug. Elke rij heeft een verborgen veld _rij
 * met het rijnummer in de spreadsheet. Volledig lege rijen slaan we over.
 */
function leesTabel(naam) {
  var blad = spreadsheet().getSheetByName(naam);
  if (!blad) throw new Error('Het tabblad "' + naam + '" bestaat niet. Voer eerst "Installeer tabbladen" uit.');
  var waarden = blad.getDataRange().getValues();
  var kop = (waarden[0] || []).map(function (k) { return schoon(k); });
  var rijen = [];
  for (var r = 1; r < waarden.length; r++) {
    var obj = { _rij: r + 1 };
    var leeg = true;
    for (var k = 0; k < kop.length; k++) {
      if (!kop[k]) continue;
      var w = waarden[r][k];
      if (isDatumObject(w)) w = parseerDatum(w);
      // Een datum die iemand als tekst typte (20/11/2026), ook omzetten.
      else if (typeof w === 'string' && w && DATUMKOLOMMEN.indexOf(kop[k]) > -1) w = parseerDatum(w) || w;
      if (!isLeeg(w)) leeg = false;
      obj[kop[k]] = w;
    }
    if (!leeg) rijen.push(obj);
  }
  return { naam: naam, blad: blad, kop: kop, rijen: rijen };
}

/**
 * Bestuur: gegevens van een lener aanpassen of op inactief zetten.
 * invoer: { lenersnummer, voornaam, achternaam, telefoon, email, actief }
 */
function lenerAanpassen(staat, invoer) {
  var l = lenerVan(staat, invoer.lenersnummer);
  if (!l) return { ok: false, fout: 'Deze lener bestaat niet.' };
  var voornaam = tekstInvoer(invoer.voornaam, 50);
  var telefoon = tekstInvoer(invoer.telefoon, 25);
  var email = tekstInvoer(invoer.email, 100).toLowerCase();
  if (!voornaam) return { ok: false, fout: 'Vul een voornaam in.' };
  if (!telefoon && !email) return { ok: false, fout: 'Vul een telefoonnummer of een e-mailadres in (of allebei).' };
  if (email && !geldigEmail(email)) return { ok: false, fout: 'Dit e-mailadres lijkt niet te kloppen.' };
  if (telefoon && !geldigeTelefoon(telefoon)) return { ok: false, fout: 'Dit telefoonnummer lijkt niet te kloppen.' };
  wijzig(l, {
    voornaam: voornaam, achternaam: tekstInvoer(invoer.achternaam, 80), telefoon: telefoon, email: email,
    actief: invoer.actief === false ? 'nee' : 'ja'
  });
  staat.log.push(['lener aangepast', 'lener ' + l.lenersnummer]);
  return { ok: true, tekst: 'Lener ' + l.lenersnummer + ' is bijgewerkt.' };
}

/* ---------- Informatie voor de schermen ---------- */

/** "12 (Sam)": wat een vrijwilliger van een lener mag zien. */
function lenerNaam(staat, lenersnummer) {
  var l = lenerVan(staat, lenersnummer);
  return lenersnummer + (l && l.voornaam ? ' (' + l.voornaam + ')' : '');
}

function lenerVan(staat, lenersnummer) {
  var n = String(parseerGetal(lenersnummer));
  for (var i = 0; i < staat.leners.length; i++) {
    if (String(staat.leners[i].lenersnummer) === n) return staat.leners[i];
  }
  return null;
}

/** Levenshtein-afstand: het aantal tikfouten tussen twee woorden. */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var vorige = [];
  for (var j = 0; j <= b.length; j++) vorige[j] = j;
  for (var i = 1; i <= a.length; i++) {
    var huidige = [i];
    for (var k = 1; k <= b.length; k++) {
      var kost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
      huidige[k] = Math.min(vorige[k] + 1, huidige[k - 1] + 1, vorige[k - 1] + kost);
    }
    vorige = huidige;
  }
  return vorige[b.length];
}

/**
 * Schrijft een regel in het Logboek. Zet hier nooit contactgegevens in,
 * enkel nummers (boek-ID, lenersnummer, uitlening-ID).
 */
function logboek(wie, actie, details) {
  var blad = spreadsheet().getSheetByName('Logboek');
  if (!blad) return;
  blad.appendRow([new Date(), veiligeCel(schoon(wie) || 'systeem'), actie, veiligeCel(details || '')]);
}

function lopendeUitleningen(staat) {
  return staat.uitleningen.filter(function (u) { return u.exemplaar && isLeeg(u.datum_terug); });
}

function lopendeUitleningenVan(staat, lenersnummer) {
  return lopendeUitleningen(staat).filter(function (u) { return String(u.lenersnummer) === String(lenersnummer); });
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

/** Menu: bouwt de Catalogus op uit Stock en Zines. */
function maakCatalogus() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = spreadsheet();
    var inst = leesInstellingen();
    var bron = [];
    [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
      var blad = ss.getSheetByName(paar[0]);
      if (blad) bron = bron.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
    });
    if (!bron.length) throw new Error('Geen boeken gevonden in de tabbladen Stock en Zines.');
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    var teller = voegBronSamen(tabel.rijen, bron, ids.nieuw, inst, vandaagTekst());
    schrijfVolledig(tabel);
    ids.bewaar();
    var onderwerpen = werkOnderwerpenBij();
    leegCache();
    logboek('menu', 'maakCatalogus', teller.nieuw + ' nieuw, ' + teller.aangevuld + ' aangevuld');
    meld('Catalogus klaar: ' + teller.nieuw + ' nieuwe boeken, ' + teller.aangevuld + ' aangevuld. ' +
      onderwerpen + ' nieuwe genres in Onderwerpen. Kijk de boeken met een ongeldig ISBN na (kolom isbn_origineel).');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Maakt een generator voor nieuwe boek-ID's: B0001 voor boeken, Z0001 voor zines.
 * De teller staat in de scripteigenschappen, zodat een ID nooit twee keer gebruikt wordt,
 * ook niet als je een boek wist. Roep bewaar() op als je klaar bent.
 */
function maakIdGenerator(catalogusRijen) {
  var props = PropertiesService.getScriptProperties();
  var tellers = {};
  ['B', 'Z'].forEach(function (prefix) {
    var laatste = Number(props.getProperty('teller_boek_' + prefix) || 0);
    catalogusRijen.forEach(function (r) {
      var id = String(r.boek_id || '');
      if (id.charAt(0) === prefix) laatste = Math.max(laatste, Number(id.slice(1)) || 0);
    });
    tellers[prefix] = laatste;
  });
  return {
    nieuw: function (soort) {
      var prefix = soort === 'zine' ? 'Z' : 'B';
      tellers[prefix] += 1;
      return prefix + metNullen(tellers[prefix], 4);
    },
    bewaar: function () {
      props.setProperty('teller_boek_B', String(tellers.B));
      props.setProperty('teller_boek_Z', String(tellers.Z));
    }
  };
}

/**
 * Bepaalt de Nederlandse en de Engelse beschrijving.
 * vertaal(tekst, doeltaal) geeft de vertaling (in Apps Script: LanguageApp).
 *   - Is de tekst al Nederlands (de vertaling naar het Nederlands verandert niets),
 *     dan blijft beschrijving precies zoals ze was.
 *   - Een Engelse versie die je zelf invulde in beschrijving_en, blijft staan.
 */
function maakTweetaligeBeschrijving(boek, vertaal) {
  var origineel = schoonMetRegels(boek.beschrijving);
  var v = {};
  var nl = schoonMetRegels(vertaal(origineel, 'nl'));
  if (nl && !zelfdeTekst(nl, origineel)) v.beschrijving = nl;
  if (isLeeg(boek.beschrijving_en)) {
    var en = schoonMetRegels(vertaal(origineel, 'en'));
    if (en) v.beschrijving_en = en;
  }
  return v;
}

/** "2026-11" naar "november 2026". */
function maandTekst(jjjjmm) {
  var d = jjjjmm.split('-');
  return MAANDEN[Number(d[1]) - 1] + ' ' + d[0];
}

/** Markeert een rij om te verwijderen (enkel gebruikt bij de privacy-opruiming). */
function markeerVerwijderen(rij) {
  rij._verwijderen = true;
}

/** Toont een melding in de spreadsheet (of in het logboek als er geen scherm is). */
function meld(tekst) {
  try {
    SpreadsheetApp.getUi().alert(tekst);
  } catch (e) {
    try { spreadsheet().toast(tekst, 'Madrigal', 10); } catch (e2) { Logger.log(tekst); }
  }
}

/** Vult een nummer aan met nullen: 7 wordt "0007". */
function metNullen(n, breedte) {
  var s = String(n);
  while (s.length < breedte) s = '0' + s;
  return s;
}

/** "2026-11-20" naar een Date in UTC (enkel om mee te rekenen). */
function naarUtc(datum) {
  var d = datum.split('-');
  return new Date(Date.UTC(Number(d[0]), Number(d[1]) - 1, Number(d[2])));
}

/** Menu: vraagt de link naar het oude blad en neemt de lopende uitleningen over. */
function neemUitleningenOver() {
  var ui = SpreadsheetApp.getUi();
  var vraag = ui.prompt('Lopende uitleningen overnemen',
    'Plak de link naar het oude digitale uitleenblad (de Google-spreadsheet). Enkel boeken die nog niet terug zijn, komen mee.',
    ui.ButtonSet.OK_CANCEL);
  if (vraag.getSelectedButton() !== ui.Button.OK) return;
  var link = schoon(vraag.getResponseText());
  var oud;
  try {
    oud = SpreadsheetApp.openByUrl(link);
  } catch (e) {
    meld('Ik kan dat blad niet openen. Kijk of de link klopt en of jouw account het blad mag openen.');
    return;
  }
  // Het eerste tabblad met een kolom "Boek".
  var rijen = [];
  oud.getSheets().some(function (blad) {
    rijen = leesOudeUitleningen(blad.getDataRange().getValues());
    return rijen.length > 0;
  });
  if (!rijen.length) {
    meld('Ik vond geen tabblad met een kolom "Boek" in het oude blad.');
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var staat = laadStaat('overzetten', false);
    var resultaat = verwerkOudeUitleningen(staat, rijen);
    var naTeKijken = leesTabel('Na te kijken');
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken.map(function (x) {
      x.waarde_bron = x.waarde_bron + ' [' + x.sleutel_extra + ']';
      return x;
    }), 'Overzetten', staat.vandaag);
    bewaarStaat(staat);
    bewaarTabel(naTeKijken);
    leegCache();
    logboek('menu', 'neemUitleningenOver', resultaat.uitleningen + ' uitleningen, ' + resultaat.leners + ' leners, ' + nieuw + ' na te kijken');
    meld(resultaat.uitleningen + ' lopende uitleningen overgenomen, ' + resultaat.leners + ' nieuwe leners aangemaakt. ' +
      nieuw + ' twijfelgevallen staan in "Na te kijken". Vraag nieuwe leners bij hun volgende bezoek om toestemming voor de privacyverklaring (kolom toestemming_privacy staat op "onbekend").');
  } finally {
    lock.releaseLock();
  }
}

/** Staat er in de herkomst een interne notitie dat het boek niet publiek mag? */
function nietPubliekVolgensHerkomst(herkomst) {
  return /niet\s+(op\s+(de\s+)?)?(site|website|online)|niet\s+publiek/i.test(herkomst || '');
}

/**
 * Nieuwe lener inschrijven.
 * invoer: { voornaam, achternaam, telefoon, email, toestemming }
 */
function nieuweLener(staat, invoer) {
  var voornaam = tekstInvoer(invoer.voornaam, 50);
  var achternaamWaarde = tekstInvoer(invoer.achternaam, 80);
  var telefoon = tekstInvoer(invoer.telefoon, 25);
  var email = tekstInvoer(invoer.email, 100).toLowerCase();
  if (!voornaam) return { ok: false, fout: 'Vul een voornaam in.' };
  if (!telefoon && !email) return { ok: false, fout: 'Vul een telefoonnummer of een e-mailadres in (of allebei).' };
  if (email && !geldigEmail(email)) return { ok: false, fout: 'Dit e-mailadres lijkt niet te kloppen.' };
  if (telefoon && !geldigeTelefoon(telefoon)) return { ok: false, fout: 'Dit telefoonnummer lijkt niet te kloppen.' };
  if (invoer.toestemming !== true) return { ok: false, fout: 'Zonder toestemming voor de privacyverklaring kunnen we geen gegevens bewaren.' };
  var dubbel = staat.leners.filter(function (l) {
    return (email && String(l.email).toLowerCase() === email) || (telefoon && l.telefoon && telefoonSleutel(l.telefoon) === telefoonSleutel(telefoon));
  })[0];
  if (dubbel) return { ok: false, fout: 'Deze persoon is al ingeschreven als lener ' + lenerNaam(staat, dubbel.lenersnummer) + '.' };
  var nummer = nieuwNummer(staat, 'lener', staat.leners.map(function (l) { return l.lenersnummer; }));
  voegToe(staat.leners, {
    lenersnummer: nummer, voornaam: voornaam, achternaam: achternaamWaarde, telefoon: telefoon, email: email,
    datum_inschrijving: staat.vandaag, toestemming_privacy: 'ja', actief: 'ja'
  });
  staat.log.push(['nieuwe lener', 'lener ' + nummer]);
  return { ok: true, lenersnummer: nummer, voornaam: voornaam, tekst: 'Lenersnummer ' + nummer };
}

/**
 * Nieuw volgnummer. In de spreadsheet levert Api.js een teller die nooit terugtelt.
 * Zonder teller (in de tests) nemen we het hoogste bestaande nummer plus 1.
 */
function nieuwNummer(staat, soort, bestaande) {
  if (staat.nieuwNummer) return staat.nieuwNummer(soort, bestaande);
  var max = 0;
  bestaande.forEach(function (w) { max = Math.max(max, Number(String(w).replace(/\D/g, '')) || 0); });
  return max + 1;
}

/* ---------- Controle van invoer ---------- */

/**
 * Normaliseert een ISBN of ISSN zoals het in de stocklijst staat.
 * Geeft een object terug:
 *   isbn:    het ISBN-13 als het geldig is, anders ''
 *   issn:    het ISSN (formaat 1234-5678) als het een ISSN is, anders ''
 *   geldig:  true als het nummer klopt
 *   leeg:    true als er niets ingevuld was
 */
function normaliseerIsbn(waarde) {
  var ruw = schoon(waarde).toUpperCase();
  if (!ruw) return { isbn: '', issn: '', geldig: false, leeg: true };
  // Een getal uit de spreadsheet kan als 9.78E+12 binnenkomen: zet het eerst om.
  if (typeof waarde === 'number') ruw = String(Math.round(waarde));
  var tekens = ruw.replace(/^ISBN|^ISSN/, '').replace(/[^0-9X]/g, '');
  if (tekens.length === 10 && isbn10Geldig(tekens)) return { isbn: isbn10Naar13(tekens), issn: '', geldig: true, leeg: false };
  if (tekens.length === 13 && isbn13Geldig(tekens)) return { isbn: tekens, issn: '', geldig: true, leeg: false };
  if (tekens.length === 8) return { isbn: '', issn: tekens.slice(0, 4) + '-' + tekens.slice(4), geldig: true, leeg: false };
  return { isbn: '', issn: '', geldig: false, leeg: false };
}

/* ---------- Getallen en datums ---------- */

/** Maakt de taal eenvormig: "engels", "EN" en "English" worden "Engels". */
function normaliseerTaal(waarde) {
  var t = normaliseerTekst(waarde);
  if (!t) return '';
  var tabel = {
    'nederlands': 'Nederlands', 'nl': 'Nederlands', 'dutch': 'Nederlands', 'vlaams': 'Nederlands', 'ned': 'Nederlands',
    'engels': 'Engels', 'en': 'Engels', 'english': 'Engels', 'eng': 'Engels',
    'frans': 'Frans', 'fr': 'Frans', 'french': 'Frans', 'francais': 'Frans', 'fre': 'Frans',
    'duits': 'Duits', 'de': 'Duits', 'german': 'Duits', 'deutsch': 'Duits', 'ger': 'Duits',
    'spaans': 'Spaans', 'es': 'Spaans', 'spanish': 'Spaans', 'spa': 'Spaans'
  };
  if (tabel[t]) return tabel[t];
  var s = schoon(waarde);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Kleine letters, zonder accenten en leestekens. "Émile Zola!" wordt "emile zola". */
function normaliseerTekst(waarde) {
  return schoon(waarde)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Maakt de uitvoering eenvormig (Hardcover, Paperback, Pocket). */
function normaliseerUitvoering(waarde) {
  var t = normaliseerTekst(waarde);
  if (!t) return '';
  if (t.indexOf('hard') > -1 || t === 'gebonden') return 'Hardcover';
  if (t.indexOf('pocket') > -1 || t.indexOf('mass market') > -1) return 'Pocket';
  if (t.indexOf('paper') > -1 || t.indexOf('soft') > -1 || t === 'ingenaaid') return 'Paperback';
  var s = schoon(waarde);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- ISBN ---------- */

/** Een beschrijving uit Open Library: tekst, of een object met value. */
function olTekst(description) {
  if (!description) return '';
  return typeof description === 'string' ? description : String(description.value || '');
}

/** Zet het menu klaar telkens de spreadsheet opent. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Madrigal')
    .addItem('1. Installeer tabbladen', 'installeer')
    .addItem('2. Bouw de catalogus uit Stock en Zines', 'maakCatalogus')
    .addItem('3. Vul aan uit Goodreads', 'vulAanUitGoodreads')
    .addItem('4. Vul aan uit Open Library', 'vulAanUitOpenLibrary')
    .addItem('5. Zoek ontbrekende covers bij Google Books', 'vulAanUitGoogleBooks')
    .addItem('6. Zoek ontbrekende beschrijvingen', 'vulBeschrijvingenAan')
    .addItem('7. Vertaal de beschrijvingen (Nederlands en Engels)', 'vertaalBeschrijvingen')
    .addSeparator()
    .addItem('Nieuwe boeken verwerken', 'verwerkNieuweBoeken')
    .addItem('Werk de vertaaltabel Onderwerpen bij', 'werkOnderwerpenBijMenu')
    .addItem('Ververs de publieke catalogus', 'verversMenu')
    .addSeparator()
    .addItem('Neem lopende uitleningen over uit het oude blad', 'neemUitleningenOver')
    .addItem('Neem nieuws, agenda en vragen over van de oude website', 'importeerOudeSite')
    .addItem('Privacy-opruiming nu uitvoeren', 'ruimOp')
    .addSeparator()
    .addItem('Catalogus wissen en opnieuw opbouwen (enkel bij de start)', 'herbouwCatalogus')
    .addToUi();
}

/** Opmaak van de kopregel: vet, vastgezet. */
function opmaakKop(blad, kolommen) {
  if (kolommen < 1) return;
  blad.getRange(1, 1, 1, kolommen).setFontWeight('bold');
  blad.setFrozenRows(1);
}

/** Een afbeelding: een volledige link, of een pad in de opslag van de oude databank. */
function oudeAfbeelding(waarde, basis) {
  var w = schoon(waarde);
  if (!w) return '';
  if (/^https:\/\//.test(w)) return w;
  if (/^http:\/\//.test(w)) return w.replace(/^http:/, 'https:');
  return basis ? basis + '/storage/v1/object/public/' + w.replace(/^\//, '') : w;
}

/** Datum uit een ISO-tijdstip, in de tijdzone van Brussel ("2026-11-20"). */
function oudeDatum(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return parseerDatum(iso);
  return typeof Utilities !== 'undefined' ? Utilities.formatDate(d, tz || 'Europe/Brussels', 'yyyy-MM-dd') : d.toISOString().slice(0, 10);
}

/** Zoekt een kolom in de kop van het oude blad, op het begin van de naam. */
function oudeKolom(kop, begin) {
  for (var i = 0; i < kop.length; i++) if (kop[i].indexOf(begin) === 0) return i;
  return -1;
}

/** Uur uit een ISO-tijdstip, in de tijdzone van Brussel ("19:30"). Leeg als het middernacht is. */
function oudUur(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var uur = typeof Utilities !== 'undefined' ? Utilities.formatDate(d, tz || 'Europe/Brussels', 'HH:mm') : d.toISOString().slice(11, 16);
  return uur === '00:00' ? '' : uur;
}

/**
 * Zet een datum om naar tekst "JJJJ-MM-DD".
 * Werkt met een Date-object, "2026-11-20", "20/11/2026", "20-11-2026" of "20.11.26".
 * Geeft '' als het geen datum is.
 */
function parseerDatum(waarde) {
  if (isLeeg(waarde)) return '';
  if (isDatumObject(waarde)) {
    return waarde.getFullYear() + '-' + tweeCijfers(waarde.getMonth() + 1) + '-' + tweeCijfers(waarde.getDate());
  }
  var t = schoon(waarde);
  var m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return geldigeDatum(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    var jaar = Number(m[3]);
    if (jaar < 100) jaar += 2000;
    return geldigeDatum(jaar, Number(m[2]), Number(m[1]));
  }
  return '';
}

/** Zet "5", "5,00", "€ 5" of 5 om naar het getal 5. Geeft null als er geen getal in staat. */
function parseerGetal(waarde) {
  if (typeof waarde === 'number') return isNaN(waarde) ? null : waarde;
  var m = schoon(waarde).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Plant de vertaling over een paar minuten (één keer). */
function planVertaling(minuten) {
  verwijderTriggers('vertaalBeschrijvingen');
  ScriptApp.newTrigger('vertaalBeschrijvingen').timeBased().after(minuten * 60 * 1000).create();
}

/** De publieke catalogus als JSON-tekst, uit de cache als die er is. */
function publiekeCatalogusJson() {
  var cache = CacheService.getScriptCache();
  var aantal = Number(cache.get(CACHE_SLEUTEL + '_n') || 0);
  if (aantal > 0) {
    var sleutels = [];
    for (var i = 0; i < aantal; i++) sleutels.push(CACHE_SLEUTEL + '_' + i);
    var stukken = cache.getAll(sleutels);
    if (Object.keys(stukken).length === aantal) {
      return sleutels.map(function (s) { return stukken[s]; }).join('');
    }
  }
  var staat = laadStaat('publiek', false);
  verwerkVervallenReservatiesStil(staat);
  var tekst = JSON.stringify(bouwPubliekeCatalogus(staat, leesTabel('Onderwerpen').rijen));
  var waarden = {};
  var n = Math.ceil(tekst.length / CACHE_STUK);
  for (var j = 0; j < n; j++) waarden[CACHE_SLEUTEL + '_' + j] = tekst.slice(j * CACHE_STUK, (j + 1) * CACHE_STUK);
  waarden[CACHE_SLEUTEL + '_n'] = String(n);
  try { cache.putAll(waarden, CACHE_DUUR_SECONDEN); } catch (err) { /* te groot voor de cache: dan zonder */ }
  return tekst;
}

/** Teksten die de publieke catalogus mag tonen. Nooit codes of andere interne waarden. */
function publiekeTeksten(inst) {
  return {
    welkom: inst.tekst_welkom,
    uitleg: inst.tekst_uitleg_lenen,
    privacy: inst.tekst_privacy,
    welkom_en: inst.tekst_welkom_en,
    uitleg_en: inst.tekst_uitleg_lenen_en,
    privacy_en: inst.tekst_privacy_en
  };
}

/** Reservatie zoals de schermen ze tonen. */
function reservatieInfo(staat, r, plaats) {
  var boek = boekVan(staat, r.boek_id);
  return {
    reservatie_id: r.reservatie_id, boek_id: r.boek_id, titel: boek ? boek.titel : r.boek_id,
    lenersnummer: r.lenersnummer, voornaam: (lenerVan(staat, r.lenersnummer) || {}).voornaam || '',
    datum_reservatie: r.datum_reservatie, status: r.status, exemplaar: r.exemplaar,
    ophalen_tot: r.ophalen_tot, plaats: plaats,
    tekst: r.status === STATUS_KLAAR
      ? 'Ligt apart (' + r.exemplaar + ') tot en met ' + datumTekst(r.ophalen_tot, staat.vandaag)
      : 'Wacht sinds ' + datumTekst(r.datum_reservatie, staat.vandaag) + ', plaats ' + plaats + ' in de wachtrij'
  };
}

function reservatieVan(staat, reservatieId) {
  return staat.reservaties.filter(function (r) { return String(r.reservatie_id) === String(reservatieId); })[0] || null;
}

/**
 * Reserveren: zet een lener in de wachtrij voor een boek.
 * invoer: { boek_id, lenersnummer }
 */
function reserveren(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  if (jaNee(boek.uitleenbaar) === 'nee') return { ok: false, fout: 'Dit boek is niet uitleenbaar.' };
  var lener = lenerVan(staat, invoer.lenersnummer);
  if (!lener) return { ok: false, fout: 'Er is geen lener met nummer ' + tekstInvoer(invoer.lenersnummer, 10) + '.' };
  if (jaNee(lener.actief) === 'nee') return { ok: false, fout: 'Deze lener staat op inactief.' };
  var actief = actieveReservaties(staat, boek.boek_id);
  if (actief.some(function (r) { return String(r.lenersnummer) === String(lener.lenersnummer); })) {
    return { ok: false, fout: 'Deze lener staat al in de wachtrij voor dit boek.' };
  }
  if (lopendeUitleningenVan(staat, lener.lenersnummer).some(function (u) { return u.boek_id === boek.boek_id; })) {
    return { ok: false, fout: 'Deze lener heeft dit boek nu zelf in huis.' };
  }
  var b = beschikbaarheid(staat, boek);
  if (b.beschikbaar > 0) return { ok: false, fout: 'Er staat een exemplaar in de bib. Je kan het meteen uitlenen.' };
  var r = voegToe(staat.reservaties, {
    reservatie_id: 'R' + metNullen(nieuwNummer(staat, 'reservatie', staat.reservaties.map(function (x) { return x.reservatie_id; })), 4),
    boek_id: boek.boek_id, lenersnummer: lener.lenersnummer, datum_reservatie: staat.vandaag,
    status: STATUS_WACHT, exemplaar: '', datum_klaar: '', ophalen_tot: '', datum_afgesloten: '', vrijwilliger: staat.wie
  });
  staat.log.push(['reserveren', r.reservatie_id + ' ' + boek.boek_id + ' voor lener ' + lener.lenersnummer]);
  return { ok: true, tekst: 'Lener ' + lenerNaam(staat, lener.lenersnummer) + ' staat op plaats ' + (actief.length + 1) + ' in de wachtrij voor "' + boek.titel + '".' };
}

/** Zet een rij-object om naar een lijst celwaarden volgens de kop. */
function rijNaarWaarden(kop, obj) {
  return kop.map(function (k) { return k ? celWaarde(k, obj[k]) : ''; });
}

/** Welke rol hoort bij een code? '' als de code niet klopt. */
function rolVoorCode(code, inst) {
  var c = schoon(code);
  if (!c) return '';
  if (inst.code_bestuur && c === String(inst.code_bestuur)) return 'bestuur';
  if (inst.toegangscode_balie && c === String(inst.toegangscode_balie)) return 'balie';
  return '';
}

/** Menu en nachtelijke planning: voert de opruiming uit op de spreadsheet. */
function ruimOp() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var staat = laadStaat('systeem', true);
    // Vervallen reservaties doorgeven gebeurt ook hier, zodat de wachtrij elke nacht klopt.
    verwerkVervallenReservaties(staat);
    var teller = ruimOpStaat(staat);
    bewaarStaat(staat);
    logboek('systeem', 'privacy-opruiming', teller.koppelingen + ' koppelingen gewist, ' + teller.leners + ' leners gewist');
  } finally {
    lock.releaseLock();
  }
  leegCache();
}

/**
 * Pure versie van de opruiming, voor de tests.
 * staat: zoals in Uitlenen.js, plus staat.uitzonderingenTabel.
 * Geeft het aantal gewiste koppelingen en leners terug.
 */
function ruimOpStaat(staat) {
  var grens = telMaandenOp(staat.vandaag, -staat.inst.bewaartermijn_afgesloten_uitleningen_maanden);
  var teller = { koppelingen: 0, leners: 0 };

  staat.uitleningen.forEach(function (u) {
    if (!isLeeg(u.datum_terug) && u.datum_terug < grens && !isLeeg(u.lenersnummer)) {
      wijzig(u, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });
  staat.reservaties.forEach(function (r) {
    var afgesloten = r.status !== STATUS_WACHT && r.status !== STATUS_KLAAR;
    var datum = r.datum_afgesloten || r.datum_reservatie;
    if (afgesloten && datum && datum < grens && !isLeeg(r.lenersnummer)) {
      wijzig(r, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });
  (staat.uitzonderingenTabel || []).forEach(function (x) {
    if (x.datum && x.datum < grens && !isLeeg(x.lenersnummer)) {
      wijzig(x, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });

  staat.leners.forEach(function (l) {
    if (jaNee(l.actief) !== 'nee') return;
    var nr = String(l.lenersnummer);
    var laatste = String(l.datum_inschrijving || '');
    var nogIets = false;
    staat.uitleningen.forEach(function (u) {
      if (String(u.lenersnummer) !== nr) return;
      if (isLeeg(u.datum_terug)) nogIets = true;
      [u.datum_uit, u.datum_terug].forEach(function (d) { if (d && d > laatste) laatste = d; });
    });
    staat.reservaties.forEach(function (r) {
      if (String(r.lenersnummer) === nr && (r.status === STATUS_WACHT || r.status === STATUS_KLAAR)) nogIets = true;
    });
    if (!nogIets && laatste < grens) {
      markeerVerwijderen(l);
      teller.leners++;
    }
  });
  return teller;
}

/** Haalt spaties aan begin en einde weg en maakt dubbele spaties enkel. */
function schoon(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde).replace(/\s+/g, ' ').trim();
}

/** Zoals schoon, maar regeleinden en lege regels (alinea's) blijven. */
function schoonMetRegels(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Schrijft een volledige tabel in één keer (gebruikt bij de opbouw van de catalogus). */
function schrijfVolledig(tabel) {
  var blad = tabel.blad;
  var kop = tabel.kop;
  var oud = blad.getLastRow();
  if (tabel.rijen.length) {
    blad.getRange(2, 1, tabel.rijen.length, kop.length).setValues(tabel.rijen.map(function (r) { return rijNaarWaarden(kop, r); }));
  }
  // Wat er vroeger onder stond (bv. lege rijen), maken we leeg.
  if (oud > tabel.rijen.length + 1) {
    blad.getRange(tabel.rijen.length + 2, 1, oud - tabel.rijen.length - 1, kop.length).clearContent();
  }
  tabel.rijen.forEach(function (r, i) { r._rij = i + 2; r._nieuw = false; r._gewijzigd = false; });
}

/** De inhoud van de startpagina als JSON-tekst, uit de cache als die er is. */
function siteInhoudJson() {
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get(SITE_CACHE_SLEUTEL);
  if (bewaard) return bewaard;
  var staat = laadStaat('publiek', false);
  var lees = function (naam) {
    return spreadsheet().getSheetByName(naam) ? leesTabel(naam).rijen : [];
  };
  var tekst = JSON.stringify(bouwSiteInhoud(staat, { nieuws: lees('Nieuws'), agenda: lees('Agenda'), faq: lees('Veelgestelde vragen') }));
  try { cache.put(SITE_CACHE_SLEUTEL, tekst, CACHE_DUUR_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  return tekst;
}

/** Splitst een lijst in een cel ("a, b; c") in losse, opgeschoonde waarden. */
function splitsLijst(waarde) {
  return schoon(waarde).split(/[,;\n]+/).map(schoon).filter(function (x) { return x; });
}

/** Het actieve spreadsheetbestand. */
function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Stelt filtergroepen voor op basis van woorden in het genre. */
function stelFiltergroepenVoor(genre) {
  var g = normaliseerTekst(genre);
  var groepen = [];
  ONDERWERP_VOORSTELLEN.forEach(function (paar) {
    if (paar[0].test(g) && groepen.indexOf(paar[1]) === -1) groepen.push(paar[1]);
  });
  return groepen;
}

/** Tekstveld: opgeschoond en ingekort. */
function tekstInvoer(waarde, max) {
  return schoon(waarde).slice(0, max || 100);
}

/** Telt een aantal dagen op bij een datum (negatief mag ook). */
function telDagenOp(datum, dagen) {
  var d = naarUtc(datum);
  d.setUTCDate(d.getUTCDate() + dagen);
  return vanUtc(d);
}

/** Telefoon vergelijkbaar maken: +32 470 12 34 56 en 0470/12.34.56 worden gelijk. */
function telefoonSleutel(t) {
  var c = String(t || '').replace(/\D/g, '');
  if (c.indexOf('0032') === 0) c = '0' + c.slice(4);
  else if (c.indexOf('32') === 0 && c.length === 11) c = '0' + c.slice(2);
  return c;
}

/* ---------- Grenzen ---------- */

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

/**
 * Terugbrengen.
 * invoer: { uitlening_id, borg_terugbetaald: true/false }
 */
function terugbrengen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var velden = { datum_terug: staat.vandaag };
  if (invoer.borg_terugbetaald === true && Number(u.borg) > 0) velden.borg_terugbetaald = staat.vandaag;
  wijzig(u, velden);
  staat.log.push(['terugbrengen', u.uitlening_id + ' ' + u.exemplaar]);
  var melding = geefExemplaarDoor(staat, u.boek_id, u.exemplaar);
  var boek = boekVan(staat, u.boek_id);
  return {
    ok: true,
    tekst: '"' + (boek ? boek.titel : u.exemplaar) + '" is teruggebracht.' +
      (velden.borg_terugbetaald ? ' Borg van ' + bedragTekst(u.borg) + ' terugbetaald.' : (Number(u.borg) > 0 ? ' De borg staat nog open.' : '')),
    apartLeggen: melding ? [melding] : []
  };
}

/** Tijdzone van het script, voor datums van vandaag. */
function tijdzone() {
  return Session.getScriptTimeZone() || 'Europe/Brussels';
}

/**
 * Sleutel om titels te vergelijken: zonder ondertitel (na ":"), zonder reeksinfo
 * tussen haakjes en zonder lidwoorden.
 */
function titelSleutel(titel) {
  var t = schoon(titel).replace(/\(.*?\)/g, ' ').split(':')[0];
  return woorden(t).join(' ');
}

/** Vult aan met nullen: 7 wordt "07". */
function tweeCijfers(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Een tekst in beide talen. Lege Engelse versie: de Nederlandse. */
function tweetalig(rij, veld) {
  var nl = schoon(rij[veld]);
  return { nl: nl, en: schoon(rij[veld + '_en']) || nl };
}

/** Een tekst met meerdere regels: enkel spaties aan begin en einde weg. */
function tweetaligLang(rij, veld) {
  var nl = String(rij[veld] || '').trim();
  return { nl: nl, en: String(rij[veld + '_en'] || '').trim() || nl };
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

/**
 * Uitlenen.
 * invoer: { exemplaar, lenersnummer, borg, betaalwijze, gift, uitzondering: { reden } }
 */
function uitlenen(staat, invoer) {
  var ex = exemplaarInfo(staat, invoer.exemplaar);
  if (!ex) return { ok: false, fout: 'Dit exemplaar bestaat niet.' };
  if (jaNee(ex.boek.uitleenbaar) === 'nee') return { ok: false, fout: 'Dit boek is niet uitleenbaar.' };
  if (uitleningVanExemplaar(staat, ex.exemplaar)) return { ok: false, fout: 'Dit exemplaar is al uitgeleend. Kies een ander exemplaar of registreer eerst het terugbrengen.' };
  var lener = lenerVan(staat, invoer.lenersnummer);
  if (!lener) return { ok: false, fout: 'Er is geen lener met nummer ' + tekstInvoer(invoer.lenersnummer, 10) + '.' };
  if (jaNee(lener.actief) === 'nee') return { ok: false, fout: 'Deze lener staat op inactief. Vraag het bestuur om de lener weer actief te zetten.' };
  var borg = bedragInvoer(invoer.borg);
  var gift = bedragInvoer(invoer.gift);
  if (borg === null) return { ok: false, fout: 'Vul een geldig bedrag in voor de borg.' };
  if (gift === null) return { ok: false, fout: 'Vul een geldig bedrag in voor de gift.' };
  var betaalwijze = tekstInvoer(invoer.betaalwijze, 20);
  if (borg > 0 && staat.inst.borg_betaalwijzen.indexOf(betaalwijze) === -1) {
    return { ok: false, fout: 'Kies hoe de borg betaald werd: ' + staat.inst.borg_betaalwijzen.join(' of ') + '.' };
  }

  var stop = behandelGrenzen(staat, 'uitlenen', { lener: lener, boek: ex.boek, exemplaar: ex.exemplaar }, invoer);
  if (stop) return stop;

  var verval = berekenVervaldatum(staat.vandaag, staat.inst);
  var u = voegToe(staat.uitleningen, {
    uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
    exemplaar: ex.exemplaar, boek_id: ex.boek.boek_id, lenersnummer: lener.lenersnummer,
    datum_uit: staat.vandaag, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: '',
    aantal_verlengingen: 0, datum_verlenging: '', borg: borg, betaalwijze_borg: borg > 0 ? betaalwijze : '',
    borg_terugbetaald: '', gift: gift || '', laatste_herinnering: '', vrijwilliger: staat.wie, bron: ''
  });

  // Had deze lener een reservatie voor dit boek? Dan is die nu afgehaald.
  var meldingen = [];
  actieveReservaties(staat, ex.boek.boek_id).forEach(function (r) {
    if (String(r.lenersnummer) !== String(lener.lenersnummer)) return;
    var vrijExemplaar = r.status === STATUS_KLAAR && r.exemplaar && r.exemplaar !== ex.exemplaar ? r.exemplaar : '';
    wijzig(r, { status: STATUS_AFGEHAALD, datum_afgesloten: staat.vandaag });
    // De lener nam een ander exemplaar mee dan het apart gelegde: dat gaat naar de volgende.
    if (vrijExemplaar) {
      var m = geefExemplaarDoor(staat, ex.boek.boek_id, vrijExemplaar);
      if (m) meldingen.push(m);
    }
  });

  staat.log.push(['uitlenen', u.uitlening_id + ' ' + u.exemplaar + ' aan lener ' + lener.lenersnummer]);
  return {
    ok: true,
    terugTekst: 'Breng terug tegen ' + datumTekst(verval, staat.vandaag),
    vervaldatum: verval,
    uitlening: uitleningInfo(staat, u),
    apartLeggen: meldingen
  };
}

/**
 * Een uitlening zoals de schermen ze tonen.
 * metContact: true enkel voor het bestuur (telefoon, e-mail, achternaam).
 */
function uitleningInfo(staat, u, metContact) {
  var boek = boekVan(staat, u.boek_id);
  var lener = lenerVan(staat, u.lenersnummer);
  var info = {
    uitlening_id: u.uitlening_id, exemplaar: u.exemplaar, boek_id: u.boek_id,
    titel: boek ? boek.titel : '(onbekend boek)', auteur: boek ? boek.auteur : '',
    lenersnummer: u.lenersnummer, voornaam: lener ? lener.voornaam : '',
    datum_uit: u.datum_uit, vervaldatum: u.vervaldatum,
    oorspronkelijke_vervaldatum: u.oorspronkelijke_vervaldatum,
    aantal_verlengingen: Number(u.aantal_verlengingen || 0),
    borg: Number(u.borg || 0), betaalwijze_borg: u.betaalwijze_borg,
    status: isLeeg(u.datum_terug) ? uitleenStatus(u, staat.vandaag, staat.inst) : null
  };
  if (metContact) {
    info.achternaam = lener ? lener.achternaam : '';
    info.telefoon = lener ? lener.telefoon : '';
    info.email = lener ? lener.email : '';
    info.laatste_herinnering = u.laatste_herinnering;
  }
  return info;
}

function uitleningVan(staat, uitleningId) {
  return staat.uitleningen.filter(function (u) { return String(u.uitlening_id) === String(uitleningId); })[0] || null;
}

function uitleningVanExemplaar(staat, exemplaar) {
  return lopendeUitleningen(staat).filter(function (u) { return u.exemplaar === exemplaar; })[0] || null;
}

/** De datum van vandaag als "JJJJ-MM-DD". */
function vandaagTekst() {
  return Utilities.formatDate(new Date(), tijdzone(), 'yyyy-MM-dd');
}

/** Date in UTC terug naar "JJJJ-MM-DD". */
function vanUtc(d) {
  return d.getUTCFullYear() + '-' + tweeCijfers(d.getUTCMonth() + 1) + '-' + tweeCijfers(d.getUTCDate());
}

/**
 * Maakt een tekst veilig om in een cel te schrijven.
 * Tekst die met = + - of @ begint, zou de spreadsheet als formule lezen.
 * Telefoonnummers met een 0 vooraan en lange cijferreeksen (ISBN) blijven tekst.
 */
function veiligeCel(waarde) {
  if (typeof waarde !== 'string') return waarde;
  if (/^[=+\-@]/.test(waarde) || /^0\d/.test(waarde) || /^\d{8,}$/.test(waarde)) return "'" + waarde;
  return waarde;
}

/** Enkel https-links naar afbeeldingen. Zo kan er geen vreemde code via een cover binnensluipen. */
function veiligeCoverUrl(url) {
  var u = schoon(url);
  return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
}

/**
 * Verlengen.
 * invoer: { uitlening_id, uitzondering: { reden } }
 */
function verlengen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var stop = behandelGrenzen(staat, 'verlengen', { uitlening: u, boek: boekVan(staat, u.boek_id), lener: lenerVan(staat, u.lenersnummer) }, invoer);
  if (stop) return stop;
  var nieuw = berekenVerlenging(u.vervaldatum, staat.inst);
  wijzig(u, {
    vervaldatum: nieuw,
    aantal_verlengingen: Number(u.aantal_verlengingen || 0) + 1,
    datum_verlenging: staat.vandaag,
    oorspronkelijke_vervaldatum: u.oorspronkelijke_vervaldatum || u.vervaldatum
  });
  staat.log.push(['verlengen', u.uitlening_id + ' tot ' + nieuw]);
  return { ok: true, terugTekst: 'Nieuwe datum: breng terug tegen ' + datumTekst(nieuw, staat.vandaag), vervaldatum: nieuw, uitlening: uitleningInfo(staat, u) };
}

/** Menu: vertaalt de beschrijvingen naar het Nederlands en het Engels, in porties. */
function vertaalBeschrijvingen() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { planVertaling(5); return; } // een andere bewerking loopt: straks opnieuw
  var verwerkt = 0, rest = 0, limiet = false;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('beschrijving_vertaald') === -1 || tabel.kop.indexOf('beschrijving_en') === -1) {
      meld('De kolommen beschrijving_en en beschrijving_vertaald ontbreken nog in de Catalogus. Voer eerst "installeer" uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var vertaal = function (tekst, taal) { return LanguageApp.translate(tekst, '', taal); };
    var teDoen = tabel.rijen.filter(heeftVertalingNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BS_MAX_LOOPTIJD_MS) break;
      var velden;
      try {
        velden = maakTweetaligeBeschrijving(teDoen[i], vertaal);
      } catch (e) {
        // Meestal de daglimiet van Google Translate.
        limiet = true;
        break;
      }
      velden.beschrijving_vertaald = vandaag;
      wijzig(teDoen[i], velden);
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarTabel(tabel);
      Utilities.sleep(200);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftVertalingNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('vertaalBeschrijvingen');
  if (rest > 0) planVertaling(limiet ? 24 * 60 : 1);
  if (verwerkt) leegCache();
  logboek('menu', 'vertaalBeschrijvingen', verwerkt + ' vertaald, ' + rest + ' te gaan' + (limiet ? ' (daglimiet van Google Translate)' : ''));
  var tekst = verwerkt + ' beschrijvingen vertaald.';
  if (rest > 0) tekst += limiet ? ' De daglimiet van Google Translate is bereikt: morgen gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is vertaald.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/** Leest de vertaaltabel als object: genre -> lijst filtergroepen. */
function vertaalTabel(onderwerpRijen) {
  var vertaal = {};
  onderwerpRijen.forEach(function (r) {
    vertaal[normaliseerTekst(r.genre)] = splitsLijst(r.filtergroepen);
  });
  return vertaal;
}

function verversMenu() {
  leegCache();
  meld('De publieke catalogus haalt bij de volgende opvraging alles vers op.');
}

/**
 * Haalt uit het antwoord van Google Books (één "volumeInfo") de velden die nog leeg zijn.
 * Geeft een object veld -> waarde terug.
 */
function verwerkGoogleBooks(boek, info) {
  var v = {};
  if (!info) return v;
  var links = info.imageLinks || {};
  var cover = links.thumbnail || links.smallThumbnail;
  if (isLeeg(boek.cover_url) && cover) {
    // Altijd https, zonder het omgekrulde hoekje dat Google soms toevoegt.
    v.cover_url = String(cover).replace(/^http:/, 'https:').replace(/&edge=curl/, '');
  }
  if (isLeeg(boek.uitgeverij) && info.publisher) v.uitgeverij = schoon(info.publisher);
  if (isLeeg(boek.jaartal) && info.publishedDate) {
    var m = String(info.publishedDate).match(/\d{4}/);
    if (m) v.jaartal = Number(m[0]);
  }
  if (isLeeg(boek.paginas) && info.pageCount) v.paginas = Number(info.pageCount);
  if (isLeeg(boek.taal) && GB_TALEN[info.language]) v.taal = GB_TALEN[info.language];
  if (isLeeg(boek.beschrijving) && info.description) {
    var b = schoon(String(info.description).replace(/<[^>]*>/g, ' '));
    if (b) v.beschrijving = b.length > 600 ? b.slice(0, 597).replace(/\s+\S*$/, '') + '...' : b;
  }
  return v;
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
      // Teksten, adres en openingsuren mogen meerdere regels hebben.
      var meerdereRegels = sleutel.indexOf('tekst_') === 0 || ['adres', 'openingsuren', 'openingsuren_en'].indexOf(sleutel) > -1;
      inst[sleutel] = isDatumObject(waarde) ? parseerDatum(waarde) : (meerdereRegels ? String(waarde).trim() : schoon(waarde));
    }
  });
  inst.openingsdagen = weekdagNummers(inst.openingsdagen);
  inst.borg_betaalwijzen = splitsLijst(inst.borg_betaalwijzen);
  inst.gesloten_data = splitsLijst(inst.gesloten_data).map(parseerDatum).filter(function (d) { return d; });
  // Een enkele datum als Date-object in de cel.
  if (isDatumObject(ruw.gesloten_data)) inst.gesloten_data = [parseerDatum(ruw.gesloten_data)];
  return inst;
}

/**
 * Menu: verwerkt boeken die je met de hand onderaan de Catalogus toevoegde.
 * Geeft ze een boek-ID, maakt het ISBN en de taal netjes, en vult aan uit
 * Goodreads (als dat tabblad bestaat) en Open Library.
 */
function verwerkNieuweBoeken() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var aantal = 0;
  try {
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    tabel.rijen.forEach(function (rij) {
      if (!isLeeg(rij.boek_id)) return;
      var soort = normaliseerTekst(rij.soort) === 'zine' ? 'zine' : 'boek';
      var isbn = normaliseerIsbn(rij.isbn);
      var velden = {
        boek_id: ids.nieuw(soort),
        soort: soort,
        titel: schoon(rij.titel), auteur: schoon(rij.auteur),
        isbn: isbn.isbn || isbn.issn || schoon(rij.isbn),
        taal: normaliseerTaal(rij.taal),
        uitvoering: normaliseerUitvoering(rij.uitvoering),
        nieuwstaat: jaNee(rij.nieuwstaat),
        aantal: parseerGetal(rij.aantal) || 1,
        uitleenbaar: jaNee(rij.uitleenbaar) || 'ja',
        publiek: jaNee(rij.publiek) || 'ja',
        toegevoegd_op: parseerDatum(rij.toegevoegd_op) || vandaagTekst()
      };
      velden.bron_sleutel = bronSleutel({ soort: soort, isbn: velden.isbn, titel: velden.titel, auteur: velden.auteur });
      wijzig(rij, velden);
      aantal++;
    });
    bewaarTabel(tabel);
    ids.bewaar();
  } finally {
    lock.releaseLock();
  }
  werkOnderwerpenBij();
  leegCache();
  if (spreadsheet().getSheetByName('Goodreads-export')) vulAanUitGoodreads(true);
  meld(aantal + ' nieuwe boeken kregen een boek-ID. Open Library vult nu de rest aan.');
  vulAanUitOpenLibrary();
}

/**
 * Haalt uit het antwoord van Open Library (jscmd=details) de velden die nog leeg zijn.
 * details: het "details"-object van één ISBN.
 * Geeft een object veld -> waarde terug (enkel voor lege velden).
 */
function verwerkOpenLibrary(boek, details) {
  var v = {};
  if (!details) return v;
  if (isLeeg(boek.uitgeverij) && details.publishers && details.publishers.length) v.uitgeverij = schoon(details.publishers[0]);
  if (isLeeg(boek.jaartal) && details.publish_date) {
    var m = String(details.publish_date).match(/\d{4}/);
    if (m) v.jaartal = Number(m[0]);
  }
  if (isLeeg(boek.paginas) && details.number_of_pages) v.paginas = Number(details.number_of_pages);
  if (isLeeg(boek.taal) && details.languages && details.languages.length) {
    var code = String(details.languages[0].key || '').split('/').pop();
    if (OL_TALEN[code]) v.taal = OL_TALEN[code];
  }
  if (isLeeg(boek.beschrijving) && details.description) {
    var b = typeof details.description === 'string' ? details.description : details.description.value;
    b = schoon(b);
    if (b) v.beschrijving = b.length > 600 ? b.slice(0, 597).replace(/\s+\S*$/, '') + '...' : b;
  }
  if (isLeeg(boek.cover_url) && details.covers && details.covers.length && details.covers[0] > 0) {
    v.cover_url = 'https://covers.openlibrary.org/b/id/' + details.covers[0] + '-M.jpg';
  }
  return v;
}

/**
 * Verwerkt de oude rijen in de staat (zonder de spreadsheet aan te raken).
 * Geeft { uitleningen, leners, naTeKijken } terug.
 */
function verwerkOudeUitleningen(staat, oudeRijen) {
  var teller = { uitleningen: 0, leners: 0 };
  var naTeKijken = [];
  var bekend = {};
  staat.uitleningen.forEach(function (u) { if (u.bron) bekend[u.bron] = true; });

  oudeRijen.forEach(function (o) {
    if (!isLeeg(o.terug_op)) return; // al teruggebracht: blijft in het oude blad
    var bron = 'oud blad rij ' + o.rijnummer;
    if (bekend[bron]) return;

    // 1. De lener: bestaat die al (zelfde e-mail of telefoon)?
    var lener = staat.leners.filter(function (l) {
      return (o.email && String(l.email).toLowerCase() === o.email) ||
        (o.telefoon && l.telefoon && telefoonSleutel(l.telefoon) === telefoonSleutel(o.telefoon));
    })[0];
    if (!lener) {
      lener = voegToe(staat.leners, {
        lenersnummer: String(nieuwNummer(staat, 'lener', staat.leners.map(function (l) { return l.lenersnummer; }))),
        voornaam: o.voornaam || '?', achternaam: o.achternaam, telefoon: o.telefoon, email: o.email,
        datum_inschrijving: o.datum_uit || staat.vandaag,
        toestemming_privacy: 'onbekend', actief: 'ja'
      });
      teller.leners++;
    }

    // 2. Het boek.
    var gevonden = zoekBoekOpTitel(staat.catalogus, o.boek, o.auteur);
    var boek = gevonden.zeker;
    var exemplaar = '';
    if (boek) {
      exemplaar = exemplarenVan(boek).filter(function (ex) { return !uitleningVanExemplaar(staat, ex); })[0] || '';
    }
    var borg = leesBorg(o.borg, staat.inst);
    var context = 'Lener ' + lener.lenersnummer + ', geleend op ' + korteDatum(o.datum_uit) +
      ', terug tegen ' + korteDatum(o.datum_terug_afgesproken) + ', borg ' + bedragTekst(borg.bedrag) + (borg.betaalwijze ? ' (' + borg.betaalwijze + ')' : '') + '.';
    if (!boek || !exemplaar) {
      naTeKijken.push({
        boek_id: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.boek_id; }).join(', ') : '',
        titel: o.boek, veld: 'uitlening', waarde_catalogus: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.titel + ' / ' + b.auteur; }).join(' | ') : '(geen boek gevonden)',
        waarde_bron: o.boek + ' / ' + o.auteur,
        opmerking: (boek ? 'Alle exemplaren staan al als uitgeleend. ' : 'Het boek is niet zeker gevonden. ') + context +
          ' Registreer deze uitlening zelf via het uitleenscherm.',
        sleutel_extra: bron
      });
      bekend[bron] = true;
      return;
    }

    // 3. De uitlening.
    var datumUit = o.datum_uit || staat.vandaag;
    var verval = o.datum_terug_afgesproken || berekenVervaldatum(datumUit, staat.inst);
    var gift = parseerGetal(o.gift);
    voegToe(staat.uitleningen, {
      uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
      exemplaar: exemplaar, boek_id: boek.boek_id, lenersnummer: lener.lenersnummer,
      datum_uit: datumUit, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: '',
      aantal_verlengingen: 0, datum_verlenging: '', borg: borg.bedrag, betaalwijze_borg: borg.betaalwijze,
      borg_terugbetaald: '', gift: gift || '',
      laatste_herinnering: parseerDatum(o.herinnering) || schoon(o.herinnering),
      vrijwilliger: 'overgezet', bron: bron
    });
    bekend[bron] = true;
    teller.uitleningen++;
  });
  return { uitleningen: teller.uitleningen, leners: teller.leners, naTeKijken: naTeKijken };
}

/**
 * Zet klaarliggende reservaties die niet op tijd afgehaald werden op "vervallen"
 * en geeft het exemplaar door aan de volgende. Geeft de meldingen terug.
 */
function verwerkVervallenReservaties(staat) {
  var meldingen = [];
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_KLAAR && r.ophalen_tot && r.ophalen_tot < staat.vandaag) {
      wijzig(r, { status: STATUS_VERVALLEN, datum_afgesloten: staat.vandaag });
      staat.log.push(['reservatie vervallen', r.reservatie_id]);
      var m = geefExemplaarDoor(staat, r.boek_id, r.exemplaar);
      if (m) meldingen.push(m);
    }
  });
  return meldingen;
}

/* ---------- Acties ---------- */

/** Vervallen reservaties bijwerken zonder het publieke verzoek te laten mislukken. */
function verwerkVervallenReservatiesStil(staat) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    verwerkVervallenReservaties(staat);
    bewaarStaat(staat);
  } finally {
    lock.releaseLock();
  }
}

/** Verwijdert geplande uitvoeringen van een functie. */
function verwijderTriggers(functienaam) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === functienaam) ScriptApp.deleteTrigger(t);
  });
}

/** Zoekt het adres en de publieke sleutel van de databank in de code van de oude website. */
function vindOudeDatabank() {
  var html = UrlFetchApp.fetch(OUDE_SITE).getContentText();
  var main = (html.match(/main\.[a-f0-9]+\.js/) || [])[0];
  if (!main) throw new Error('Ik vond de code van de oude website niet.');
  var code = UrlFetchApp.fetch(OUDE_SITE + main).getContentText();
  var url = (code.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
  var sleutel = (code.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) || [])[0];
  if (!url || !sleutel) throw new Error('Ik vond het adres van de oude databank niet.');
  return { url: url, sleutel: sleutel };
}

/**
 * Voegt de boeken uit Stock en Zines samen met de bestaande Catalogus.
 * bestaand: rijen van de Catalogus (worden aangevuld, nooit overschreven).
 * bron: boek-objecten uit leesBronRijen.
 * nieuwId: functie(soort) die een nieuwe, unieke boek-ID geeft.
 * Geeft { nieuw, aangevuld } terug (aantallen).
 */
function voegBronSamen(bestaand, bron, nieuwId, inst, vandaag) {
  // Bij de eerste opbouw is niets "nieuw binnen". Daarna krijgt een nieuw boek de datum van vandaag.
  var datumNieuw = bestaand.length && vandaag ? vandaag : '';
  // 1. Dubbele rijen in de bron samenvoegen: aantallen optellen, herkomst bundelen.
  var perSleutel = {};
  var volgorde = [];
  bron.forEach(function (b) {
    var s = bronSleutel(b);
    if (!perSleutel[s]) { perSleutel[s] = b; volgorde.push(s); return; }
    var eerste = perSleutel[s];
    eerste.aantal += b.aantal;
    if (b.herkomst && eerste.herkomst.indexOf(b.herkomst) === -1) {
      eerste.herkomst = eerste.herkomst ? eerste.herkomst + ' | ' + b.herkomst : b.herkomst;
    }
    Object.keys(b).forEach(function (k) { if (isLeeg(eerste[k]) && !isLeeg(b[k])) eerste[k] = b[k]; });
  });

  // 2. Bestaande rijen opzoeken op hun bronsleutel.
  var index = {};
  bestaand.forEach(function (rij) { if (rij.bron_sleutel) index[rij.bron_sleutel] = rij; });

  var teller = { nieuw: 0, aangevuld: 0 };
  volgorde.forEach(function (s) {
    var b = perSleutel[s];
    var rij = index[s];
    if (rij) {
      // Enkel lege velden aanvullen. Wat iemand met de hand invulde, blijft.
      var velden = {};
      ['titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat', 'aanrader', 'genre', 'herkomst', 'isbn_origineel'].forEach(function (k) {
        if (isLeeg(rij[k]) && !isLeeg(b[k])) velden[k] = b[k];
      });
      if (isLeeg(rij.aantal)) velden.aantal = b.aantal;
      if (Object.keys(velden).length) { wijzig(rij, velden); teller.aangevuld++; }
      return;
    }
    var teKoop = b.soort === 'zine' && normaliseerTekst(b.genre) === 'verkoop';
    var nieuweRij = {
      boek_id: nieuwId(b.soort),
      soort: b.soort,
      titel: b.titel, auteur: b.auteur, isbn: b.isbn, uitgeverij: b.uitgeverij, jaartal: b.jaartal,
      taal: b.taal, paginas: b.paginas, uitvoering: b.uitvoering, nieuwstaat: b.nieuwstaat,
      aanrader: b.aanrader, genre: b.genre, extra_onderwerpen: '', klassieker: '',
      aantal: b.aantal,
      uitleenbaar: teKoop && !inst.zines_te_koop_uitleenbaar ? 'nee' : 'ja',
      publiek: nietPubliekVolgensHerkomst(b.herkomst) ? 'nee' : 'ja',
      beschrijving: '', cover_url: '', startpagina: '', toegevoegd_op: datumNieuw,
      herkomst: b.herkomst, isbn_origineel: b.isbn_origineel, bron_sleutel: s, ol_gecontroleerd: ''
    };
    voegToe(bestaand, nieuweRij);
    index[s] = nieuweRij;
    teller.nieuw++;
  });
  return teller;
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

/** Voegt rijen toe die er nog niet zijn (op bron_id). Geeft het aantal nieuwe terug. */
function voegOudeRijenToe(bestaande, nieuwe) {
  var bekend = {};
  bestaande.forEach(function (r) { if (r.bron_id) bekend[r.bron_id] = true; });
  var n = 0;
  nieuwe.forEach(function (r) {
    if (bekend[r.bron_id]) return;
    voegToe(bestaande, r);
    bekend[r.bron_id] = true;
    n++;
  });
  return n;
}

/** Voegt een nieuwe rij toe aan een lijst en markeert ze als nieuw. */
function voegToe(lijst, obj) {
  obj._nieuw = true;
  lijst.push(obj);
  return obj;
}

/** Voert een actie uit. Wijzigende acties gebeuren onder een slot, zodat twee balies elkaar niet storen. */
function voerActieUit(actie, invoer, rol) {
  if (actie === 'aanmelden') return { ok: true, rol: rol };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, fout: 'Het is even druk. Probeer het over een paar seconden opnieuw.' };
  try {
    var staat = laadStaat(invoer.wie, actie === 'bestuurData');
    var meldingen = verwerkVervallenReservaties(staat);
    var antwoord;
    switch (actie) {
      case 'balieData': antwoord = { ok: true, data: balieGegevens(staat) }; break;
      case 'bestuurData': antwoord = { ok: true, data: bestuurGegevens(staat, leesTabel('Onderwerpen').rijen) }; break;
      case 'uitlenen': antwoord = uitlenen(staat, invoer); break;
      case 'terugbrengen': antwoord = terugbrengen(staat, { uitlening_id: invoer.uitlening_id, borg_terugbetaald: invoer.borg_terugbetaald === true }); break;
      case 'verlengen': antwoord = verlengen(staat, invoer); break;
      case 'reserveren': antwoord = reserveren(staat, invoer); break;
      case 'annuleerReservatie': antwoord = annuleerReservatie(staat, invoer); break;
      case 'nieuweLener': antwoord = nieuweLener(staat, { voornaam: invoer.voornaam, achternaam: invoer.achternaam, telefoon: invoer.telefoon, email: invoer.email, toestemming: invoer.toestemming === true }); break;
      case 'borgTerugbetaald': antwoord = borgTerugbetaald(staat, invoer); break;
      case 'herinneringVerstuurd': antwoord = herinneringVerstuurd(staat, invoer); break;
      case 'lenerAanpassen': antwoord = lenerAanpassen(staat, { lenersnummer: invoer.lenersnummer, voornaam: invoer.voornaam, achternaam: invoer.achternaam, telefoon: invoer.telefoon, email: invoer.email, actief: invoer.actief !== false }); break;
    }
    // Ook bij een geweigerde actie bewaren we vervallen reservaties.
    bewaarStaat(staat);
    if (meldingen.length || (antwoord.ok && actie !== 'balieData' && actie !== 'bestuurData')) leegCache();
    if (meldingen.length && antwoord.ok) antwoord.apartLeggen = (antwoord.apartLeggen || []).concat(meldingen);
    return antwoord;
  } finally {
    lock.releaseLock();
  }
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
 * Geeft een nieuw, uniek volgnummer. Het laatste nummer staat in de
 * scripteigenschappen, zodat een gewist nummer nooit opnieuw gebruikt wordt.
 * bestaande: lijst met bestaande waarden, om bij de eerste keer verder te tellen.
 */
function volgendNummer(sleutel, bestaande) {
  var props = PropertiesService.getScriptProperties();
  var laatste = Number(props.getProperty('teller_' + sleutel) || 0);
  bestaande.forEach(function (w) {
    var n = Number(String(w).replace(/\D/g, ''));
    if (n > laatste) laatste = n;
  });
  laatste += 1;
  props.setProperty('teller_' + sleutel, String(laatste));
  return laatste;
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
    var shelf = leesInstellingen().goodreads_shelf;
    var goodreads = leesGoodreadsRijen(blad.getDataRange().getValues(), shelf);
    if (!goodreads.length) {
      meld(shelf ? 'Ik vond geen boeken op de shelf "' + shelf + '". Kijk in Instellingen of de naam van goodreads_shelf precies klopt.' : 'Het tabblad Goodreads-export is leeg.');
      return;
    }
    var catalogus = leesTabel('Catalogus');
    var naTeKijken = leesTabel('Na te kijken');
    var resultaat = koppelGoodreads(catalogus.rijen, goodreads);
    resultaat.aanvullingen.forEach(function (a) {
      var v = {}; v[a.veld] = a.waarde;
      wijzig(a.boek, v);
    });
    // Oude rijen van Goodreads die nog niet afgehandeld zijn, vervangen we door de nieuwe.
    naTeKijken.rijen = naTeKijken.rijen.filter(function (r) { return r.bron !== 'Goodreads' || jaNee(r.afgehandeld) === 'ja'; });
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken, 'Goodreads', vandaagTekst());
    bewaarTabel(catalogus);
    schrijfVolledig(naTeKijken);
    leegCache();
    logboek('menu', 'vulAanUitGoodreads', resultaat.aanvullingen.length + ' velden aangevuld, ' + nieuw + ' na te kijken');
    if (!stil) meld(goodreads.length + ' boeken van Goodreads gebruikt' + (shelf ? ' (shelf "' + shelf + '")' : '') + '. ' +
      resultaat.aanvullingen.length + ' velden aangevuld. ' + nieuw + ' nieuwe twijfelgevallen in "Na te kijken". ' +
      'Je mag het tabblad Goodreads-export nu verwijderen: het bevat ook de rest van je persoonlijke bibliotheek.');
  } finally {
    lock.releaseLock();
  }
}

/** Menu: vult covers aan uit Google Books, in porties. */
function vulAanUitGoogleBooks() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.');
    return;
  }
  var verwerkt = 0, aangevuld = 0, rest = 0, limiet = false;
  try {
    var sleutel = leesInstellingen().google_books_api_key;
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('gb_gecontroleerd') === -1) {
      meld('De kolom gb_gecontroleerd ontbreekt nog in de Catalogus. Voer eerst "installeer" uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftGoogleBooksNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > GB_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + boek.isbn + (sleutel ? '&key=' + encodeURIComponent(sleutel) : '');
      var antwoord = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var code = antwoord.getResponseCode();
      if (code === 429 || code === 403) { limiet = true; break; } // daglimiet bereikt
      if (code >= 500) break;                                       // storing bij Google: later verder
      var data = {};
      try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = {}; }
      var info = data.items && data.items.length ? data.items[0].volumeInfo : null;
      var velden = verwerkGoogleBooks(boek, info);
      if (velden.cover_url) aangevuld++;
      velden.gb_gecontroleerd = vandaag;
      wijzig(boek, velden);
      verwerkt++;
      // Om de 25 boeken bewaren: zo gaat er niets verloren als het script stopt.
      if (verwerkt % 25 === 0) bewaarTabel(tabel);
      Utilities.sleep(GB_PAUZE_MS);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftGoogleBooksNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('vulAanUitGoogleBooks');
  if (rest > 0) {
    // Bij de daglimiet wachten we een paar uur, anders een minuut.
    ScriptApp.newTrigger('vulAanUitGoogleBooks').timeBased().after((limiet ? 6 * 60 : 1) * 60 * 1000).create();
  } else {
    // Klaar: nu de beschrijvingen die nog ontbreken (zie Beschrijvingen.js).
    verwijderTriggers('vulBeschrijvingenAan');
    ScriptApp.newTrigger('vulBeschrijvingenAan').timeBased().after(60 * 1000).create();
  }
  if (aangevuld) leegCache();
  logboek('menu', 'vulAanUitGoogleBooks', verwerkt + ' opgevraagd, ' + aangevuld + ' covers gevonden, ' + rest + ' te gaan' + (limiet ? ' (daglimiet van Google bereikt)' : ''));
  var tekst = verwerkt + ' boeken opgevraagd bij Google Books, ' + aangevuld + ' covers gevonden.';
  if (rest > 0) tekst += limiet ? ' De daglimiet van Google is bereikt: over 6 uur gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt. Het script zoekt nu nog ontbrekende beschrijvingen.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/** Menu: vult de Catalogus aan uit Open Library, in porties. */
function vulAanUitOpenLibrary() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.');
    return;
  }
  var verwerkt = 0, aangevuld = 0, rest = 0;
  try {
    var tabel = leesTabel('Catalogus');
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftOpenLibraryNodig);
    for (var i = 0; i < teDoen.length; i += OL_PORTIE) {
      if (Date.now() - start > OL_MAX_LOOPTIJD_MS) break;
      var portie = teDoen.slice(i, i + OL_PORTIE);
      var sleutels = portie.map(function (b) { return 'ISBN:' + b.isbn; }).join(',');
      var url = 'https://openlibrary.org/api/books?format=json&jscmd=details&bibkeys=' + encodeURIComponent(sleutels);
      var antwoord = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'ProjectMadrigal-catalogus (Google Apps Script; queer bibliotheek Antwerpen)' }
      });
      if (antwoord.getResponseCode() === 429 || antwoord.getResponseCode() >= 500) {
        // Open Library vraagt om trager te gaan of heeft een storing: later verder.
        break;
      }
      var data = {};
      try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = {}; }
      portie.forEach(function (boek) {
        var gevonden = data['ISBN:' + boek.isbn];
        var velden = verwerkOpenLibrary(boek, gevonden ? gevonden.details : null);
        if (Object.keys(velden).length) aangevuld++;
        velden.ol_gecontroleerd = vandaag;
        wijzig(boek, velden);
        verwerkt++;
      });
      // Na elke portie bewaren: zo gaat er niets verloren als het script stopt.
      bewaarTabel(tabel);
      Utilities.sleep(OL_PAUZE_MS);
    }
    rest = tabel.rijen.filter(heeftOpenLibraryNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('vulAanUitOpenLibrary');
  if (rest > 0) {
    ScriptApp.newTrigger('vulAanUitOpenLibrary').timeBased().after(60 * 1000).create();
  } else {
    leegCache();
    // Klaar: Google Books zoekt nog covers voor de boeken waar Open Library er geen had.
    verwijderTriggers('vulAanUitGoogleBooks');
    ScriptApp.newTrigger('vulAanUitGoogleBooks').timeBased().after(60 * 1000).create();
  }
  logboek('menu', 'vulAanUitOpenLibrary', verwerkt + ' opgevraagd, ' + aangevuld + ' aangevuld, ' + rest + ' te gaan');
  var tekst = verwerkt + ' boeken opgevraagd bij Open Library, ' + aangevuld + ' aangevuld.';
  tekst += rest > 0 ? ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.' : ' Alles is verwerkt. Google Books zoekt nu nog ontbrekende covers.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
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
  // Nieuwe beschrijvingen gevonden? Dan vertalen (zie onderaan).
  if (gevonden) planVertaling(2);
  logboek('menu', 'vulBeschrijvingenAan', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden, ' + rest + ' te gaan' + (limiet ? ' (limiet bereikt)' : ''));
  var tekst = verwerkt + ' boeken opgezocht, ' + gevonden + ' beschrijvingen gevonden.';
  if (rest > 0) tekst += limiet ? ' De daglimiet is bereikt: over 6 uur gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/* ---------- Vertalen ---------- */

/** Pure versie van werkOnderwerpenBij, voor de tests. */
function vulOnderwerpenAan(onderwerpRijen, catalogusRijen) {
  var tellingen = {};
  var schrijfwijzen = {};
  catalogusRijen.forEach(function (b) {
    var g = normaliseerTekst(b.genre);
    if (!g) return;
    tellingen[g] = (tellingen[g] || 0) + 1;
    schrijfwijzen[g] = schrijfwijzen[g] || {};
    var s = schoon(b.genre);
    schrijfwijzen[g][s] = (schrijfwijzen[g][s] || 0) + 1;
  });
  var bekend = {};
  onderwerpRijen.forEach(function (r) {
    var g = normaliseerTekst(r.genre);
    bekend[g] = true;
    if (Number(r.aantal_boeken) !== (tellingen[g] || 0)) wijzig(r, { aantal_boeken: tellingen[g] || 0 });
  });
  var nieuw = 0;
  Object.keys(tellingen).sort().forEach(function (g) {
    if (bekend[g]) return;
    // De meest gebruikte schrijfwijze wordt de naam in de tabel.
    var naam = Object.keys(schrijfwijzen[g]).sort(function (a, b) { return schrijfwijzen[g][b] - schrijfwijzen[g][a]; })[0];
    voegToe(onderwerpRijen, { genre: naam, filtergroepen: stelFiltergroepenVoor(g).join(', '), aantal_boeken: tellingen[g] });
    nieuw++;
  });
  return nieuw;
}

/** Weekdag als getal: 0 = zondag, 5 = vrijdag. */
function weekdag(datum) {
  return naarUtc(datum).getUTCDay();
}

/** Weekdagen als tekst naar het getal van de weekdag (0 = zondag). */
function weekdagNummers(waarde) {
  return splitsLijst(waarde).map(function (w) {
    return WEEKDAGEN.indexOf(normaliseerTekst(w));
  }).filter(function (n) { return n > -1; });
}

/**
 * Zet elk genre uit de Catalogus in de vertaaltabel Onderwerpen, met een voorstel
 * voor de filtergroep. Bestaande regels blijven ongemoeid, het aantal boeken wordt bijgewerkt.
 * Geeft het aantal nieuwe genres terug.
 */
function werkOnderwerpenBij() {
  var catalogus = leesTabel('Catalogus');
  var tabel = leesTabel('Onderwerpen');
  var resultaat = vulOnderwerpenAan(tabel.rijen, catalogus.rijen);
  bewaarTabel(tabel);
  return resultaat;
}

function werkOnderwerpenBijMenu() {
  var nieuw = werkOnderwerpenBij();
  leegCache();
  meld(nieuw + ' nieuwe genres toegevoegd aan Onderwerpen. Kijk de kolom filtergroepen na.');
}

/** Past velden van een rij aan en markeert de rij als gewijzigd. */
function wijzig(rij, velden) {
  Object.keys(velden).forEach(function (k) { rij[k] = velden[k]; });
  rij._gewijzigd = true;
  return rij;
}

/** Een willekeurige code van 8 tekens, zonder tekens die je makkelijk verwart (0/O, 1/l). */
function willekeurigeCode() {
  var tekens = 'abcdefghjkmnpqrstuvwxyz23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += tekens.charAt(Math.floor(Math.random() * tekens.length));
  return code;
}

/** Woorden van een tekst, zonder lidwoorden (tenzij er dan niets overblijft). */
function woorden(waarde) {
  var alle = normaliseerTekst(waarde).split(' ').filter(function (w) { return w; });
  var zonder = alle.filter(function (w) { return LIDWOORDEN.indexOf(w) === -1; });
  return zonder.length ? zonder : alle;
}

/** Vergelijkt twee teksten zonder hoofdletters, leestekens en spaties. */
function zelfdeTekst(a, b) {
  var kaal = function (t) { return normaliseerTekst(t).replace(/[^a-z0-9]/g, ''); };
  return kaal(a) === kaal(b);
}

/** Past één instelling aan in het tabblad. */
function zetInstelling(blad, sleutel, waarde) {
  var waarden = blad.getDataRange().getValues();
  for (var r = 1; r < waarden.length; r++) {
    if (schoon(waarden[r][0]) === sleutel) {
      blad.getRange(r + 1, 2).setValue(waarde);
      return;
    }
  }
}

function zetOudeEventsOm(rijen, basis) {
  return rijen.map(function (r) {
    var moment = eersteVeld(r, ['eventDate', 'event_date', 'date', 'start']);
    return {
      datum: oudeDatum(moment), uur: oudUur(moment),
      titel: schoon(eersteVeld(r, ['title', 'titleNl', 'title_nl', 'name'])),
      titel_en: schoon(eersteVeld(r, ['titleEn', 'title_en'])),
      tekst: htmlNaarTekst(eersteVeld(r, ['content', 'contentNl', 'description', 'body', 'text', 'textNl'])),
      tekst_en: htmlNaarTekst(eersteVeld(r, ['contentEn', 'descriptionEn', 'bodyEn', 'textEn', 'text_en'])),
      locatie: schoon(eersteVeld(r, ['location', 'locatie', 'place'])),
      afbeelding: oudeAfbeelding(eersteVeld(r, ['image', 'imageUrl', 'image_url', 'cover']), basis),
      link: schoon(eersteVeld(r, ['link', 'url'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
}

function zetOudeFaqOm(rijen) {
  return rijen.map(function (r) {
    return {
      volgorde: eersteVeld(r, ['order', 'volgorde', 'position']),
      vraag: schoon(htmlNaarTekst(eersteVeld(r, ['question', 'questionNl', 'title', 'titleNl']))),
      vraag_en: schoon(htmlNaarTekst(eersteVeld(r, ['questionEn', 'question_en', 'titleEn']))),
      antwoord: htmlNaarTekst(eersteVeld(r, ['answer', 'answerNl', 'content', 'contentNl', 'text', 'textNl'])),
      antwoord_en: htmlNaarTekst(eersteVeld(r, ['answerEn', 'answer_en', 'contentEn', 'textEn'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
}

/** Zet de rijen van de oude databank om naar rijen voor de nieuwe tabbladen. */
function zetOudeNieuwsOm(rijen, basis) {
  return rijen.map(function (r) {
    return {
      datum: oudeDatum(eersteVeld(r, ['date', 'publishedAt', 'published_at', 'created_at', 'createdAt'])),
      titel: schoon(eersteVeld(r, ['title', 'titleNl', 'title_nl', 'name'])),
      titel_en: schoon(eersteVeld(r, ['titleEn', 'title_en'])),
      tekst: htmlNaarTekst(eersteVeld(r, ['content', 'contentNl', 'content_nl', 'body', 'text', 'textNl', 'description'])),
      tekst_en: htmlNaarTekst(eersteVeld(r, ['contentEn', 'content_en', 'bodyEn', 'textEn', 'text_en', 'descriptionEn'])),
      afbeelding: oudeAfbeelding(eersteVeld(r, ['image', 'imageUrl', 'image_url', 'cover', 'picture']), basis),
      link: schoon(eersteVeld(r, ['link', 'url'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
}

/** Zet de opmaak van kolommen op tekst, zodat 0470... en ISBN's niet als getal verminkt worden. */
function zetTekstopmaak(blad, kolommen) {
  if (!blad) return;
  var kop = blad.getRange(1, 1, 1, blad.getLastColumn()).getValues()[0].map(schoon);
  kolommen.forEach(function (k) {
    var i = kop.indexOf(k);
    if (i > -1 && blad.getMaxRows() > 1) blad.getRange(2, i + 1, blad.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}

/**
 * Zoekt een boek in de Catalogus op titel en auteur.
 * Geeft { zeker: boek } of { twijfel: [boeken] } of {} terug.
 */
function zoekBoekOpTitel(catalogus, titel, auteur) {
  var sleutel = titelSleutel(titel);
  var naam = achternaam(auteur);
  if (!sleutel) return {};
  var kandidaten = [];
  catalogus.forEach(function (b) {
    var s = titelSleutel(b.titel);
    if (!s) return;
    var gelijk = gelijkenis(s, sleutel);
    var bevat = (s.length >= 5 && sleutel.indexOf(s) > -1) || (sleutel.length >= 5 && s.indexOf(sleutel) > -1);
    if (gelijk < 0.8 && !bevat) return;
    var auteurOk = !naam || levenshtein(achternaam(b.auteur), naam) <= 1;
    kandidaten.push({ boek: b, score: gelijk, auteurOk: auteurOk });
  });
  var zeker = kandidaten.filter(function (k) { return k.score >= 0.95 && k.auteurOk; });
  if (zeker.length === 1) return { zeker: zeker[0].boek };
  if (!kandidaten.length) return {};
  kandidaten.sort(function (a, b) { return b.score - a.score; });
  return { twijfel: kandidaten.slice(0, 3).map(function (k) { return k.boek; }) };
}
