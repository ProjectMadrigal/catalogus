/**
 * Grenzen.js
 * Regels die de tool bewaakt, maar die een mens bewust mag overschrijden.
 *
 * Hoe werkt het?
 *   - Bij uitlenen, verlengen of reserveren controleert de tool alle grenzen
 *     die bij die actie horen.
 *   - Wordt een grens overschreden, dan toont het scherm de melding met twee
 *     knoppen: "Annuleren" en "Toch doorgaan".
 *   - Bij "Toch doorgaan" vult de vrijwilliger een reden in (verplicht).
 *     De uitzondering komt in het tabblad Uitzonderingen.
 *
 * Een grens toevoegen of wijzigen?
 *   Voeg een blok toe aan de lijst GRENZEN, met:
 *     id:         korte, unieke naam zonder spaties (komt in het tabblad Uitzonderingen)
 *     naam:       leesbare naam voor het bestuur
 *     actie:      'uitlenen', 'verlengen' of 'reserveren'
 *     controleer: een functie die de situatie (ctx) bekijkt en
 *                 - null teruggeeft als alles in orde is
 *                 - een melding (tekst) teruggeeft als de grens overschreden is
 *
 *   In ctx vind je:
 *     ctx.staat      alle gegevens (instellingen, leners, uitleningen, reservaties, catalogus)
 *     ctx.inst       de instellingen (bv. ctx.inst.max_boeken_per_lener)
 *     ctx.vandaag    de datum van vandaag als "JJJJ-MM-DD"
 *     ctx.lener      de lener (lenersnummer, voornaam, ...)
 *     ctx.boek       het boek uit de Catalogus
 *     ctx.exemplaar  het exemplaarnummer (bv. "B0012-2"), bij uitlenen
 *     ctx.uitlening  de uitlening, bij verlengen
 *
 *   Handige hulpfuncties (uit Uitlenen.js):
 *     lopendeUitleningenVan(staat, lenersnummer)
 *     actieveReservaties(staat, boek_id)
 *     lenerNaam(staat, lenersnummer)   geeft "12 (Sam)"
 */

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
