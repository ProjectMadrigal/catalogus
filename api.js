/**
 * api.js
 * Praat met de Google Apps Script web-app.
 *   - haalCatalogus: de publieke catalogus. Die wordt in de browser bewaard, zodat
 *     de lijst bij een volgend bezoek meteen verschijnt. Daarna halen we de verse
 *     versie op en tonen die zodra ze binnen is.
 *   - verstuur: acties voor het uitleenscherm en het bestuursscherm (met code).
 */
(function (root) {
  'use strict';

  var CONFIG = root.MADRIGAL_CONFIG || {};
  var CACHE_SLEUTEL = 'madrigal_catalogus_v1';

  function leesCache() {
    try {
      var tekst = root.localStorage.getItem(CACHE_SLEUTEL);
      return tekst ? JSON.parse(tekst) : null;
    } catch (e) {
      return null;
    }
  }

  function schrijfCache(tekst) {
    try { root.localStorage.setItem(CACHE_SLEUTEL, tekst); } catch (e) { /* geen opslag beschikbaar: geen probleem */ }
  }

  /** Is er een web-app ingesteld? Zonder web-app tonen we voorbeeldgegevens. */
  function isGekoppeld() {
    return !!CONFIG.apiUrl;
  }

  /**
   * Haalt de publieke catalogus op.
   * bijGegevens(data, uitCache) kan twee keer opgeroepen worden: eerst met de
   * bewaarde versie, daarna met de verse (enkel als die verschilt).
   */
  function haalCatalogus(bijGegevens, bijFout) {
    var bewaard = isGekoppeld() ? leesCache() : null;
    var bewaardeTekst = bewaard ? JSON.stringify(bewaard) : '';
    if (bewaard) bijGegevens(bewaard, true);
    var url = isGekoppeld() ? CONFIG.apiUrl + '?actie=catalogus' : 'voorbeeld/catalogus.json';
    fetch(url, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('Status ' + r.status);
        return r.text();
      })
      .then(function (tekst) {
        var data = JSON.parse(tekst);
        if (!data || !data.boeken) throw new Error('Onverwacht antwoord');
        if (isGekoppeld()) schrijfCache(tekst);
        if (JSON.stringify(data) !== bewaardeTekst) bijGegevens(data, false);
      })
      .catch(function (fout) {
        if (!bewaard) bijFout(fout);
      });
  }

  /**
   * Stuurt een actie naar de web-app. Geeft een Promise met het antwoord.
   * We gebruiken text/plain, zodat de browser geen extra controleverzoek stuurt
   * dat Google niet ondersteunt.
   */
  function verstuur(actie, gegevens) {
    if (!isGekoppeld()) {
      return Promise.resolve({ ok: false, fout: 'Het uitleenscherm is nog niet gekoppeld. Vul de apiUrl in config.js in.' });
    }
    var body = Object.assign({ actie: actie }, gegevens || {});
    return fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json(); })
      .catch(function () {
        return { ok: false, fout: 'Geen verbinding met de catalogus. Kijk of je internet hebt en probeer opnieuw.' };
      });
  }

  root.MadrigalApi = { haalCatalogus: haalCatalogus, verstuur: verstuur, isGekoppeld: isGekoppeld };
})(window);
