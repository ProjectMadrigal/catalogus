/**
 * home.js
 * De startpagina: de wisselende woorden in de hoofding, en het nieuws, de agenda,
 * de aanraders, de veelgestelde vragen en de contactgegevens uit de spreadsheet
 * (via ?actie=site). Zonder web-app tonen we verzonnen voorbeeldinhoud.
 */
(function () {
  'use strict';

  var T = window.MadrigalTaal;
  var D = window.MadrigalDom;
  var el = D.el;
  var CONFIG = window.MADRIGAL_CONFIG || {};
  var CACHE_SLEUTEL = 'madrigal_site_v1';
  var data = null;

  /** Staat er nog niets in Instellingen, dan tonen we de gegevens van de oude website. */
  var STANDAARD = {
    adres: 'Peperfabriek (eerste verdieping)\nBreughelstraat 31\n2018 Antwerpen',
    openingsuren: { nl: 'Elke vrijdag: 18:00 - 20:00', en: 'Every Friday: 18:00 - 20:00' },
    mail_algemeen: 'info@projectmadrigal.be',
    mail_events: 'events.madrigal@gmail.com'
  };

  function $(id) { return document.getElementById(id); }

  /** Kiest de tekst in de gekozen taal uit { nl, en }. */
  function tt(w) {
    if (!w) return '';
    if (typeof w === 'string') return w;
    return w[T.taal()] || w.nl || '';
  }

  /* ---------- Hoofding: "Ik ben ..." met wisselende woorden ---------- */

  var typTimer = null;
  var rustig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function startHero() {
    clearTimeout(typTimer);
    var woorden = T.t('heroWoorden');
    // Schermlezers krijgen de hele lijst één keer, niet het getyp.
    $('hero-alles').textContent = woorden.join(', ');
    var vak = $('hero-woord');
    if (rustig) { vak.textContent = woorden[woorden.length - 1]; return; }
    var i = 0, n = 0, wissen = false;
    (function stap() {
      var woord = woorden[i];
      if (!wissen) {
        n++;
        vak.textContent = woord.slice(0, n);
        if (n === woord.length) { wissen = true; typTimer = setTimeout(stap, 1800); return; }
        typTimer = setTimeout(stap, 110);
      } else {
        n--;
        vak.textContent = woord.slice(0, n);
        if (n === 0) { wissen = false; i = (i + 1) % woorden.length; typTimer = setTimeout(stap, 300); return; }
        typTimer = setTimeout(stap, 50);
      }
    })();
  }

  $('hero-zoek').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('hero-q').value.trim();
    location.href = 'boeken.html#/' + (q ? '?' + new URLSearchParams({ q: q }).toString() : '');
  });

  /* ---------- Inhoud tekenen ---------- */

  /** Een link die naar buiten gaat, opent in een nieuw tabblad. */
  function link(href, tekst) {
    var extern = /^https?:\/\//.test(href) && href.indexOf(location.host) === -1;
    return el('a', { href: href, target: extern ? '_blank' : null, rel: extern ? 'noopener' : null }, tekst);
  }

  function nieuwsKaart(n) {
    return el('article', { class: 'nieuwskaart' },
      n.afbeelding ? el('img', { src: n.afbeelding, alt: '', loading: 'lazy' }) : null,
      el('div', { class: 'inhoud' },
        el('h3', null, tt(n.titel)),
        n.datum ? el('p', { class: 'datum' }, T.datum(n.datum)) : null,
        el('div', { class: 'tekstblok' }, el('p', null, tt(n.tekst))),
        n.link ? el('p', null, link(n.link, T.t('meerInfo'))) : null));
  }

  function eventKaart(e, kop) {
    var wanneer = T.datum(e.datum) + (e.uur ? ', ' + e.uur : '');
    return el('article', { class: 'nieuwskaart' },
      e.afbeelding ? el('img', { src: e.afbeelding, alt: '', loading: 'lazy' }) : null,
      el('div', { class: 'inhoud' },
        kop ? el('p', { class: 'datum' }, kop) : null,
        el('h3', null, tt(e.titel)),
        el('p', { class: 'datum' }, wanneer + (e.locatie ? ' · ' + e.locatie : '')),
        tt(e.tekst) ? el('div', { class: 'tekstblok' }, el('p', null, tt(e.tekst))) : null,
        e.link ? el('p', null, link(e.link, T.t('meerInfo'))) : null));
  }

  function aanrader(b) {
    var letter = (b.t || '?').charAt(0).toUpperCase();
    var beeld = b.c
      ? el('img', { class: 'cover', src: b.c, alt: '', loading: 'lazy' })
      : el('div', { class: 'plaatshouder' + (b.s === 'zine' ? ' zine' : ''), 'aria-hidden': 'true' }, letter);
    if (b.c) {
      beeld.addEventListener('error', function () {
        beeld.replaceWith(el('div', { class: 'plaatshouder' + (b.s === 'zine' ? ' zine' : ''), 'aria-hidden': 'true' }, letter));
      });
    }
    var door = (b.r || []).length ? T.t('aanraderVan', { naam: b.r.join(', ') }) : '';
    return el('li', { class: 'aanrader' },
      el('a', { href: 'boeken.html#/boek/' + encodeURIComponent(b.id) },
        beeld,
        el('span', { class: 'aanrader-titel' }, b.t),
        b.a ? el('span', { class: 'aanrader-auteur' }, b.a) : null,
        door ? el('span', { class: 'aanrader-auteur' }, door) : null));
  }

  function teken() {
    if (!data) return;

    var nieuws = data.nieuws || [];
    $('nieuws-sectie').hidden = !nieuws.length;
    D.vervang($('nieuws'), nieuws.map(nieuwsKaart));

    var ag = data.agenda || {};
    var kaarten = (ag.komend || []).map(function (e, i) { return eventKaart(e, i === 0 ? T.t('volgendEvent') : ''); });
    if (!kaarten.length) kaarten.push(el('p', null, T.t('geenEvents')));
    if (ag.vorig) kaarten.push(eventKaart(ag.vorig, T.t('vorigEvent')));
    D.vervang($('agenda'), kaarten);

    var aanraders = data.aanraders || [];
    $('aanraders-sectie').hidden = !aanraders.length;
    D.vervang($('aanraders'), aanraders.map(aanrader));

    var faq = data.faq || [];
    $('faq-sectie').hidden = !faq.length;
    D.vervang($('faq'), faq.map(function (v) {
      return el('details', null, el('summary', null, tt(v.vraag)), el('div', { class: 'tekstblok' }, el('p', null, tt(v.antwoord))));
    }));

    tekenContact();
  }

  function tekenContact() {
    var c = (data && data.contact) || {};
    var veld = function (k) { return tt(c[k]) ? c[k] : STANDAARD[k]; };
    $('adres').textContent = veld('adres');
    $('openingsuren').textContent = tt(veld('openingsuren'));
    var mails = [['algemeen', veld('mail_algemeen')], ['events', veld('mail_events')]].map(function (m) {
      return el('div', null, T.t(m[0]) + ': ', el('a', { href: 'mailto:' + m[1] }, m[1]));
    });
    D.vervang($('mails'), mails);
  }

  /* ---------- Ophalen ---------- */

  function ontvang(tekst, bewaar) {
    var nieuw;
    try { nieuw = JSON.parse(tekst); } catch (e) { return; }
    if (!nieuw || !nieuw.contact) return;
    data = nieuw;
    if (bewaar) { try { localStorage.setItem(CACHE_SLEUTEL, tekst); } catch (e) { /* geen opslag */ } }
    teken();
  }

  function haal() {
    var gekoppeld = !!CONFIG.apiUrl;
    $('voorbeeld-melding').hidden = gekoppeld;
    var bewaard = null;
    if (gekoppeld) { try { bewaard = localStorage.getItem(CACHE_SLEUTEL); } catch (e) { /* geen opslag */ } }
    if (bewaard) ontvang(bewaard, false);
    fetch(gekoppeld ? CONFIG.apiUrl + '?actie=site' : 'voorbeeld/site.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Status ' + r.status); return r.text(); })
      .then(function (tekst) { if (tekst !== bewaard) ontvang(tekst, gekoppeld); })
      .catch(function () {
        if (data) return;
        // Niets binnen: de vaste contactgegevens blijven staan, de rest verdwijnt.
        data = { contact: {}, nieuws: [], agenda: {}, faq: [], aanraders: [] };
        teken();
      });
  }

  startHero();
  tekenContact();
  haal();
  document.addEventListener('taalgewijzigd', function () { startHero(); if (data) teken(); else tekenContact(); });
})();
