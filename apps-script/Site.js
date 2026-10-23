/**
 * Site.js
 * De inhoud van de startpagina: nieuws, agenda, veelgestelde vragen, aanraders
 * en de contactgegevens. Het bestuur beheert die in de tabbladen Nieuws, Agenda
 * en Veelgestelde vragen, en in Instellingen (adres, openingsuren, mailadressen).
 *
 * Publiek eindpunt: ?actie=site
 * Een rij met "nee" in de kolom publiek verschijnt niet op de website.
 * De kolommen op _en zijn de Engelse versie. Leeg? Dan toont de site het Nederlands.
 */

var SITE_CACHE_SLEUTEL = 'site_v1';
var SITE_MAX_NIEUWS = 3;
var SITE_MAX_AANRADERS = 12;

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

function isPubliek(rij) {
  return jaNee(rij.publiek) !== 'nee';
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

  // Aanraders: boeken met een aanrader, beschikbare eerst, daarna willekeurig maar vast per dag.
  var aanraders = staat.catalogus.filter(function (b) {
    return !isLeeg(b.boek_id) && !isLeeg(b.aanrader) && jaNee(b.publiek) !== 'nee';
  }).map(function (b) {
    var bs = beschikbaarheid(staat, b);
    return {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), c: veiligeCoverUrl(b.cover_url),
      s: normaliseerTekst(b.soort) === 'zine' ? 'zine' : 'boek',
      r: splitsLijst(String(b.aanrader).replace(/ en | & /g, ',')), vrij: bs.code === 'beschikbaar',
      volgorde: dagVolgorde(String(b.boek_id), staat.vandaag)
    };
  }).sort(function (a, b) { return (b.vrij - a.vrij) || (a.volgorde - b.volgorde); })
    .slice(0, SITE_MAX_AANRADERS)
    .map(function (b) { delete b.volgorde; return b; });

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

/** Een getal dat per boek en per dag anders is: zo wisselen de aanraders elke dag. */
function dagVolgorde(id, dag) {
  var tekst = id + dag;
  var h = 0;
  for (var i = 0; i < tekst.length; i++) h = (h * 31 + tekst.charCodeAt(i)) % 1000003;
  return h;
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
