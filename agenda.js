/**
 * agenda.js
 * "Zet in mijn agenda": maakt van een event een .ics-bestand dat Google Agenda,
 * Outlook en de agenda op je telefoon kunnen openen. Alles gebeurt in de browser.
 */
(function (root) {
  'use strict';

  /** Haalt uit "19:00 - 21:30" of "19u" het begin- en einduur. Geeft [] als er geen uur in staat. */
  function uren(tekst) {
    var gevonden = [];
    String(tekst || '').replace(/(\d{1,2})\s*[:.hu]\s*(\d{2})?/g, function (_, u, m) {
      var uur = Number(u), min = Number(m || 0);
      if (uur < 24 && min < 60) gevonden.push([uur, min]);
      return _;
    });
    return gevonden.slice(0, 2);
  }

  function tweeCijfers(n) { return (n < 10 ? '0' : '') + n; }

  /** Tekst veilig maken voor een .ics-bestand. */
  function icsTekst(t) {
    return String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  /**
   * Maakt de inhoud van een .ics-bestand.
   * e: { datum: "JJJJ-MM-DD", uur, titel, tekst, locatie, link } (titel en tekst als gewone tekst)
   * Zonder uur: een event van de hele dag. Zonder einduur: twee uur lang.
   */
  function maakIcs(e, nu) {
    var d = String(e.datum || '').replace(/-/g, '');
    var u = uren(e.uur);
    var regels = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Project Madrigal//Agenda//NL', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT'];
    regels.push('UID:' + d + '-' + icsTekst(e.titel).replace(/[^A-Za-z0-9]/g, '').slice(0, 30) + '@projectmadrigal');
    regels.push('DTSTAMP:' + (nu || new Date().toISOString()).replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z');
    if (u.length) {
      var eind = u[1] || [Math.min(u[0][0] + 2, 23), u[1] ? 0 : u[0][1]];
      regels.push('DTSTART;TZID=Europe/Brussels:' + d + 'T' + tweeCijfers(u[0][0]) + tweeCijfers(u[0][1]) + '00');
      regels.push('DTEND;TZID=Europe/Brussels:' + d + 'T' + tweeCijfers(eind[0]) + tweeCijfers(eind[1]) + '00');
    } else {
      var volgende = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)) + 1));
      regels.push('DTSTART;VALUE=DATE:' + d);
      regels.push('DTEND;VALUE=DATE:' + volgende.toISOString().slice(0, 10).replace(/-/g, ''));
    }
    regels.push('SUMMARY:' + icsTekst(e.titel));
    if (e.locatie) regels.push('LOCATION:' + icsTekst(e.locatie));
    var beschrijving = [e.tekst, e.link].filter(Boolean).join('\n\n');
    if (beschrijving) regels.push('DESCRIPTION:' + icsTekst(beschrijving));
    if (e.link) regels.push('URL:' + e.link);
    regels.push('END:VEVENT', 'END:VCALENDAR');
    return regels.join('\r\n') + '\r\n';
  }

  /** Laat de browser het .ics-bestand bewaren of openen. */
  function download(e) {
    var blob = new Blob([maakIcs(e)], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (String(e.titel || 'event').replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'event') + '.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  var api = { uren: uren, maakIcs: maakIcs, download: download };
  root.MadrigalAgenda = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
