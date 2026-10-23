/**
 * beheer.js
 * Gedeeld door het uitleenscherm (balie.html) en het bestuursscherm (bestuur.html):
 *   - aanmelden met een code (de browser onthoudt de code op dit toestel)
 *   - acties versturen, en bij een overschreden grens een reden vragen
 *   - statuslabels voor uitleningen
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;
  var SLEUTEL_WIE = 'madrigal_wie';

  function lees(sleutel) {
    try { return root.localStorage.getItem(sleutel) || ''; } catch (e) { return ''; }
  }
  function schrijf(sleutel, waarde) {
    try {
      if (waarde) root.localStorage.setItem(sleutel, waarde);
      else root.localStorage.removeItem(sleutel);
    } catch (e) { /* geen opslag: dan vraagt het scherm de code elke keer */ }
  }

  var sessie = { code: '', wie: '', rol: '', codeSleutel: '' };

  /**
   * Toont het aanmeldformulier, of meldt meteen aan met de bewaarde code.
   * opties: { codeSleutel, vereisteRol ('balie' of 'bestuur'), bijAangemeld(rol) }
   */
  function aanmelden(opties) {
    sessie.codeSleutel = opties.codeSleutel;
    var formulier = document.getElementById('aanmeldformulier');
    var melding = document.getElementById('aanmeld-melding');
    var codeVeld = document.getElementById('code');
    var wieVeld = document.getElementById('wie');
    wieVeld.value = lees(SLEUTEL_WIE);

    function probeer(code, wie, stil) {
      melding.hidden = true;
      return root.MadrigalApi.verstuur('aanmelden', { code: code, wie: wie }).then(function (r) {
        if (r.ok && (opties.vereisteRol !== 'bestuur' || r.rol === 'bestuur')) {
          sessie.code = code; sessie.wie = wie; sessie.rol = r.rol;
          schrijf(opties.codeSleutel, code);
          schrijf(SLEUTEL_WIE, wie);
          document.getElementById('aanmelden').hidden = true;
          document.getElementById('app').hidden = false;
          opties.bijAangemeld(r.rol);
          return;
        }
        schrijf(opties.codeSleutel, '');
        document.getElementById('aanmelden').hidden = false;
        if (!stil) {
          melding.textContent = r.ok ? 'Deze code geeft geen toegang tot het bestuursscherm.' : (r.fout || 'Aanmelden lukte niet.');
          melding.hidden = false;
          codeVeld.focus();
        }
      });
    }

    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = codeVeld.value.trim();
      var wie = wieVeld.value.trim();
      if (!code || !wie) {
        melding.textContent = 'Vul de code en je voornaam in.';
        melding.hidden = false;
        return;
      }
      var knop = formulier.querySelector('button[type="submit"]');
      knop.disabled = true;
      probeer(code, wie, false).then(function () { knop.disabled = false; codeVeld.value = ''; });
    });

    var bewaard = lees(opties.codeSleutel);
    if (bewaard && lees(SLEUTEL_WIE)) probeer(bewaard, lees(SLEUTEL_WIE), true);
    else document.getElementById('aanmelden').hidden = false;
  }

  /** Afmelden: vergeet de code op dit toestel. */
  function afmelden() {
    schrijf(sessie.codeSleutel, '');
    location.reload();
  }

  /** Wie staat er aan de balie? Wisselen zonder opnieuw de code te typen. */
  function wisselWie(nieuw) {
    sessie.wie = nieuw;
    schrijf(SLEUTEL_WIE, nieuw);
  }

  /**
   * Vraagt een reden voor een uitzondering, met de knoppen Annuleren en Toch doorgaan.
   * Geeft een Promise met de reden, of null bij Annuleren.
   */
  function vraagReden(grenzen) {
    return new Promise(function (klaar) {
      var dialoog = document.getElementById('grens-dialoog');
      var lijst = document.getElementById('grens-meldingen');
      var reden = document.getElementById('grens-reden');
      var fout = document.getElementById('grens-fout');
      D.vervang(lijst, grenzen.map(function (g) { return el('li', {}, g.melding); }));
      reden.value = '';
      fout.hidden = true;

      function sluit(waarde) {
        dialoog.removeEventListener('close', bijSluiten);
        document.getElementById('grens-doorgaan').removeEventListener('click', doorgaan);
        document.getElementById('grens-annuleren').removeEventListener('click', annuleren);
        if (dialoog.open) dialoog.close();
        klaar(waarde);
      }
      function doorgaan() {
        var tekst = reden.value.trim();
        if (tekst.length < 3) {
          fout.hidden = false;
          reden.focus();
          return;
        }
        sluit(tekst);
      }
      function annuleren() { sluit(null); }
      function bijSluiten() { sluit(null); } // Escape-toets

      document.getElementById('grens-doorgaan').addEventListener('click', doorgaan);
      document.getElementById('grens-annuleren').addEventListener('click', annuleren);
      dialoog.addEventListener('close', bijSluiten);
      dialoog.showModal();
      document.getElementById('grens-annuleren').focus();
    });
  }

  /**
   * Verstuurt een actie met de code en de naam van de vrijwilliger.
   * Is er een grens overschreden, dan vraagt dit een reden en probeert opnieuw.
   * Geeft een Promise met het antwoord. Bij Annuleren: { ok: false, geannuleerd: true }.
   * bijVraag: (optioneel) wordt opgeroepen net voor de vraag om een reden verschijnt.
   */
  function voerUit(actie, gegevens, bijVraag) {
    var body = Object.assign({ code: sessie.code, wie: sessie.wie }, gegevens || {});
    return root.MadrigalApi.verstuur(actie, body).then(function (r) {
      if (r && r.code === 'ongeldige_code') {
        afmelden();
        return r;
      }
      if (r && r.grenzen && r.grenzen.length) {
        if (bijVraag) bijVraag();
        return vraagReden(r.grenzen).then(function (reden) {
          if (reden === null) return { ok: false, geannuleerd: true };
          return voerUit(actie, Object.assign({}, gegevens, { uitzondering: { reden: reden } }), bijVraag);
        });
      }
      return r;
    });
  }

  /** Statuslabel(s) en tekst van een lopende uitlening. */
  function uitleenStatus(info) {
    var s = info.status;
    if (!s) return null;
    return el('div', {},
      el('p', { class: 'labels' },
        D.statusLabel(s.code, s.label),
        s.verlengd ? D.statusLabel('verlengd', 'Verlengd') : null),
      el('p', {}, s.tekst),
      s.verlengd ? el('p', { class: 'hulptekst' }, s.verlengdTekst) : null);
  }

  /** Een melding in een container: type 'ok', 'fout', 'info' of 'let-op'. */
  function melding(container, type, tekst) {
    D.vervang(container, el('div', { class: 'melding ' + type, role: type === 'fout' ? 'alert' : 'status' }, tekst));
  }

  root.MadrigalBeheer = {
    aanmelden: aanmelden, afmelden: afmelden, wisselWie: wisselWie, voerUit: voerUit,
    uitleenStatus: uitleenStatus, melding: melding, sessie: sessie
  };
})(window);
