/**
 * doemee.js
 * De pagina Doe mee: vrijwilliger worden, boeken schenken, steunen.
 * De teksten komen uit de Instellingen (tekst_vrijwilliger, tekst_schenken,
 * tekst_steunen en hun Engelse versie), via ?actie=site. Een leeg blok staat niet op de pagina.
 */
(function () {
  'use strict';

  var CONFIG = window.MADRIGAL_CONFIG || {};
  var T = window.MadrigalTaal;
  var data = null;
  var BLOKKEN = ['vrijwilliger', 'schenken', 'steunen'];

  function tt(w) {
    if (!w) return '';
    if (typeof w === 'string') return w;
    return w[T.taal()] || w.nl || '';
  }

  function mailLink(vak, mail) {
    vak.textContent = '';
    if (!mail) return;
    var a = document.createElement('a');
    a.className = 'knop';
    a.href = 'mailto:' + mail;
    a.textContent = T.t('dmMail') + ': ' + mail;
    vak.appendChild(a);
  }

  function teken() {
    if (!data) return;
    var doeMee = data.doeMee || {};
    var mail = (data.contact || {}).mail_algemeen || '';
    var iets = false;
    BLOKKEN.forEach(function (naam) {
      var sectie = document.getElementById('dm-' + naam);
      var tekst = tt(doeMee[naam]).trim();
      sectie.hidden = !tekst;
      if (!tekst) return;
      iets = true;
      sectie.querySelector('[data-tekst]').textContent = tekst;
      mailLink(sectie.querySelector('[data-mail]'), mail);
    });
    var leeg = document.getElementById('dm-leeg');
    leeg.hidden = iets;
    mailLink(leeg.querySelector('[data-mail]'), mail);
  }

  fetch(CONFIG.apiUrl ? CONFIG.apiUrl + '?actie=site' : 'voorbeeld/site.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) { data = d; teken(); })
    .catch(function () { data = { doeMee: {}, contact: {} }; teken(); });
  document.addEventListener('taalgewijzigd', teken);
})();
