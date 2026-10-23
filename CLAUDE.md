# Project Madrigal: website, catalogus en uitleensysteem

Queer bibliotheek in Antwerpen, gedragen door vrijwilligers. Deze repository is de volledige website op https://projectmadrigal.github.io/ (GitHub Pages, branch `main`, map root). De gebruiker is de oprichter, geen ontwikkelaar: antwoord in het Nederlands, kort en concreet, en geef bij elke wijziging aan wat die in de spreadsheet of Apps Script nog moet doen.

## Harde regels
- De repository is **publiek**. Nooit gegevens van boeken, leners of schenkers, codes, sleutels of mailadressen van leners in code, tests of voorbeelden. Tests en `voorbeeld/` gebruiken verzonnen namen.
- Alle gegevens blijven in de Google-spreadsheet. De codes (`toegangscode_balie`, `code_bestuur`) zijn een drempel, geen beveiliging.
- Geen framework, geen build-stap: gewone HTML, CSS en JavaScript, zodat vrijwilligers het later kunnen aanpassen.
- Toegankelijkheid: echte knoppen en labels, focus, `prefers-reduced-motion`, contrast in licht én donker.
- Schrijfstijl in teksten: jij-vorm (nooit u), actief, kort, geen gedachtestreepjes, geen puntkomma's.

## Opbouw
- **Publiek:** `index.html` + `home.js` (startpagina), `boeken.html` + `app.js`, `zoeken.js`, `filters.js` (catalogus), `over-ons.html`, `404.html` (oude adressen doorsturen).
- **Gedeeld:** `layout.js` (kop, menu, taalknop, donkere modus, voet met Instagram), `i18n.js` (alle vaste teksten NL/EN), `dom.js` (hulpfuncties, `plaatshouder()` voor covers), `api.js`, `config.js` (URL van de web-app).
- **Afgeschermd:** `balie.html` + `balie.js` (uitleenscherm), `bestuur.html` + `bestuur.js`, `beheer.js` (aanmelden, rooster-weergave).
- **Stijl:** `styles.css`. Kleurtokens bovenaan (`--kleur-…`), met een donkere variant onder zowel `prefers-color-scheme: dark` als `[data-theme="dark"]`. Huisstijl van de oude site: geel `#FFCD30`, paars `#6B3597`/`#9C59D1`, donker `#1B1B1C`, lettertype Geist Mono.
- **Backend:** `apps-script/*.js` (Google Apps Script, web-app met `doGet`/`doPost` in `Api.js`). Belangrijke bestanden: `Instellingen.js` (standaardinstellingen), `Ordenen.js` (groepen in Instellingen, volgorde tabbladen), `Opslag.js` (kolommen per tabblad), `Site.js` (`?actie=site`), `Publiek.js` (`?actie=catalogus`), `Rooster.js` (rooster ophalen uit de roostertool).

## Werkwijze bij een wijziging
1. Wijzig in `apps-script/` en voer daarna **`node tools/bundel.js`** uit: dat maakt `madrigal-script.gs` (één bestand om te plakken in Apps Script). Nooit met de hand aanpassen.
2. Tests: `node tests/run.js` en `BUNDEL=1 node tests/run.js`. Nieuwe logica in Apps Script krijgt een test in `tests/run.js` (bestand toevoegen in `tests/laad.js`).
3. Nieuwe instelling? Toevoegen in `STANDAARD_INSTELLINGEN` (`Instellingen.js`) **én** in een groep in `Ordenen.js`. Een test controleert dat.
4. Nieuwe tekst op de site? In `i18n.js`, in `nl` en `en`.
5. Browsercontrole kan met Playwright (Chromium staat klaar). Zet `config.js` via een route op `apiUrl: ''`, dan laden `voorbeeld/catalogus.json` en `voorbeeld/site.json`.
6. Werk op een branch, open een pull request en merge pas als de GitHub-tests slagen.
7. Vertel de gebruiker daarna wat nog met de hand moet: het nieuwe `madrigal-script.gs` plakken via een commit-specifieke link, eventueel **Madrigal > 1. Installeer tabbladen**, en bij wijzigingen in de web-app een **nieuwe versie** publiceren (Implementeren > Implementaties beheren > potloodje > Nieuwe versie).

## Wat de gebruiker zelf beheert, zonder code
Nieuws, Agenda, Veelgestelde vragen, Instellingen (teksten, adres, openingsuren, aanraders), Catalogus (boeken, `aanrader`, `startpagina`, covers, beschrijvingen). Verwijs daarheen voor je code schrijft.

## Verwante repository
`ProjectMadrigal/rooster`: het vrijwilligersrooster, een aparte tool met eigen spreadsheet en script, online op `/rooster/`.
