/**
 * dom.js
 * Kleine hulpfuncties om stukjes pagina te bouwen. We gebruiken altijd
 * textContent, nooit innerHTML met gegevens: zo kan er geen code binnensluipen
 * via een titel of naam.
 */
(function (root) {
  'use strict';

  /**
   * Maakt een element.
   *   el('p', { class: 'meta' }, 'tekst', ander element, ...)
   * Eigenschappen die met "on" beginnen, worden een gebeurtenis (onclick).
   */
  function el(tag, eigenschappen) {
    var e = document.createElement(tag);
    var props = eigenschappen || {};
    Object.keys(props).forEach(function (k) {
      var w = props[k];
      if (w === null || w === undefined || w === false) return;
      if (k.indexOf('on') === 0 && typeof w === 'function') e.addEventListener(k.slice(2), w);
      else if (k === 'class') e.className = w;
      else if (k === 'text') e.textContent = w;
      else if (w === true) e.setAttribute(k, '');
      else e.setAttribute(k, w);
    });
    for (var i = 2; i < arguments.length; i++) voegToe(e, arguments[i]);
    return e;
  }

  function voegToe(ouder, kind) {
    if (kind === null || kind === undefined || kind === false) return;
    if (Array.isArray(kind)) { kind.forEach(function (k) { voegToe(ouder, k); }); return; }
    ouder.appendChild(typeof kind === 'string' || typeof kind === 'number' ? document.createTextNode(String(kind)) : kind);
  }

  /** Maakt een element leeg en vult het met nieuwe inhoud. */
  function vervang(ouder) {
    while (ouder.firstChild) ouder.removeChild(ouder.firstChild);
    for (var i = 1; i < arguments.length; i++) voegToe(ouder, arguments[i]);
  }

  /** Een statuslabel: kleur én tekst (en een teken via CSS), nooit enkel kleur. */
  function statusLabel(code, tekst) {
    return el('span', { class: 'label status-' + code }, tekst);
  }

  /** "2026-11-20" naar "20/11/2026". */
  function korteDatum(datum) {
    if (!datum) return '';
    var d = String(datum).split('-');
    return Number(d[2]) + '/' + Number(d[1]) + '/' + d[0];
  }

  /** Bedrag in euro: 5 of 2,50. */
  function euro(n) {
    var b = Number(n || 0);
    return '€ ' + (b % 1 === 0 ? String(b) : b.toFixed(2).replace('.', ','));
  }

  root.MadrigalDom = { el: el, vervang: vervang, statusLabel: statusLabel, korteDatum: korteDatum, euro: euro };
})(window);
