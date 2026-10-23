/**
 * OudeSite.js
 * Eenmalig: neemt het nieuws, de agenda en de veelgestelde vragen over van de
 * oude website (projectmadrigal.be, met een Supabase-databank).
 *
 *   - Het script zoekt het adres en de publieke sleutel van de databank zelf op
 *     in de code van de oude website. Er staat dus geen sleutel in deze repository.
 *   - Elke rij krijgt de id van de oude databank in de kolom bron_id. Opnieuw
 *     uitvoeren maakt niets dubbel en overschrijft geen aanpassingen.
 *   - Opmaak (vet, links) gaat verloren: de teksten worden gewone tekst.
 *   - Afbeeldingen blijven op de oude server staan. Verdwijnt die, dan moet je
 *     ze zelf ergens anders zetten en de link in de kolom afbeelding aanpassen.
 */

var OUDE_SITE = 'https://www.projectmadrigal.be/';

/** De eerste niet-lege waarde uit een lijst mogelijke veldnamen. */
function eersteVeld(rij, namen) {
  for (var i = 0; i < namen.length; i++) {
    var w = rij[namen[i]];
    if (w !== undefined && w !== null && String(w).trim() !== '') return w;
  }
  return '';
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

/** Een afbeelding: een volledige link, of een pad in de opslag van de oude databank. */
function oudeAfbeelding(waarde, basis) {
  var w = schoon(waarde);
  if (!w) return '';
  if (/^https:\/\//.test(w)) return w;
  if (/^http:\/\//.test(w)) return w.replace(/^http:/, 'https:');
  return basis ? basis + '/storage/v1/object/public/' + w.replace(/^\//, '') : w;
}

/** Uur uit een ISO-tijdstip, in de tijdzone van Brussel ("19:30"). Leeg als het middernacht is. */
function oudUur(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var uur = typeof Utilities !== 'undefined' ? Utilities.formatDate(d, tz || 'Europe/Brussels', 'HH:mm') : d.toISOString().slice(11, 16);
  return uur === '00:00' ? '' : uur;
}

/** Datum uit een ISO-tijdstip, in de tijdzone van Brussel ("2026-11-20"). */
function oudeDatum(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return parseerDatum(iso);
  return typeof Utilities !== 'undefined' ? Utilities.formatDate(d, tz || 'Europe/Brussels', 'yyyy-MM-dd') : d.toISOString().slice(0, 10);
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

/** Haalt een tabel op uit de oude databank. Geeft [] als die niet bestaat. */
function haalOudeTabel(db, tabel) {
  var antwoord = UrlFetchApp.fetch(db.url + '/rest/v1/' + tabel + '?select=*', {
    muteHttpExceptions: true,
    headers: { apikey: db.sleutel, Authorization: 'Bearer ' + db.sleutel }
  });
  if (antwoord.getResponseCode() !== 200) return [];
  try { return JSON.parse(antwoord.getContentText()) || []; } catch (e) { return []; }
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
