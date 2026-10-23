# Catalogus en uitleensysteem van Project Madrigal

Project Madrigal is een queer bibliotheek in Antwerpen, gedragen door vrijwilligers. Deze repository bevat de volledige website en het uitleensysteem:

| Scherm | Voor wie | Adres |
| --- | --- | --- |
| **Startpagina** | iedereen: nieuws, agenda, aanraders, veelgestelde vragen, adres | `index.html` |
| **Boeken** (de catalogus) | iedereen, zonder account | `boeken.html` |
| **Over ons** | iedereen | `over-ons.html` |
| **Uitleenscherm** | vrijwilligers aan de balie (met code) | `balie.html` |
| **Bestuursscherm** | het bestuur (met een aparte code) | `bestuur.html` |

Daarnaast is er een **handleiding van één pagina** voor de balie, om af te drukken: `handleiding-balie.html`.

## Inhoud

1. [Wat de tool doet](#1-wat-de-tool-doet)
2. [Hoe het in elkaar zit](#2-hoe-het-in-elkaar-zit)
3. [Een kopie van de stockspreadsheet maken en het script installeren](#3-een-kopie-van-de-stockspreadsheet-maken-en-het-script-installeren)
4. [De Goodreads-export maken en als tabblad plakken](#4-de-goodreads-export-maken-en-als-tabblad-plakken)
5. [De catalogus opbouwen: de functies in volgorde](#5-de-catalogus-opbouwen-de-functies-in-volgorde)
6. [De vertaaltabel Onderwerpen nakijken](#6-de-vertaaltabel-onderwerpen-nakijken)
7. [Lopende uitleningen overnemen uit het oude uitleenblad](#7-lopende-uitleningen-overnemen-uit-het-oude-uitleenblad)
8. [Het script publiceren als web-app](#8-het-script-publiceren-als-web-app)
9. [GitHub Pages aanzetten](#9-github-pages-aanzetten)
10. [Een nieuw boek toevoegen](#10-een-nieuw-boek-toevoegen)
11. [Werken aan de balie](#11-werken-aan-de-balie)
12. [Na een wijziging in het script: een nieuwe versie publiceren](#12-na-een-wijziging-in-het-script-een-nieuwe-versie-publiceren)
13. [Privacy en veiligheid](#13-privacy-en-veiligheid)
14. [Wat te doen als iets niet werkt](#14-wat-te-doen-als-iets-niet-werkt)
15. [Waar alles staat, voor een volgende beheerder](#15-waar-alles-staat-voor-een-volgende-beheerder)
16. [De website: nieuws, agenda, vragen en Engelse teksten](#16-de-website-nieuws-agenda-vragen-en-engelse-teksten)

---

## 1. Wat de tool doet

**De publieke catalogus**

- Je zoekt op titel, auteur, uitgeverij of ISBN. Tikfouten, hoofdletters, accenten en lidwoorden (de, het, the, le, ...) maken niet uit.
- Je filtert op onderwerp, taal, nieuw of tweedehands, uitvoering, periode van uitgave, aanrader, en "enkel beschikbaar".
- Je sorteert op titel, auteur of jaartal.
- Elk boek toont een label: **beschikbaar**, **uitgeleend** (met de verwachte terugkeer), **gereserveerd** of **niet uitleenbaar**. Bij meerdere exemplaren: "1 van 2 beschikbaar".
- Elk boek heeft een eigen pagina met een vaste link, om te delen.
- De catalogus toont nooit wie een boek leent, waar een boek vandaan komt, of interne notities.

**Het uitleenscherm** vervangt het papieren uitleenblad en het oude digitale uitleenblad. Een vrijwilliger leent uit, neemt terug, verlengt, reserveert, zoekt een lener op en schrijft nieuwe leners in. Een vrijwilliger ziet van een lener enkel de voornaam en het lenersnummer.

**Het bestuursscherm** toont wat te laat is (met contactgegevens en een herinnering om te kopiëren), wat binnenkort vervalt, alle lopende uitleningen, de borgen en giften, de reservaties, de uitzonderingen, de leners en eenvoudige cijfers.

**Grenzen en uitzonderingen.** De tool bewaakt een paar regels: maximum 2 boeken per lener, 1 verlenging, niet verlengen als iemand anders wacht, niet uitlenen aan iemand met een boek te laat, en niet uitlenen van een boek dat voor iemand anders klaarligt. Een vrijwilliger mag zo'n grens bewust overschrijden, maar moet dan een reden invullen. Het bestuur ziet die reden.

## 2. Hoe het in elkaar zit

```
Google-spreadsheet (catalogus, leners, uitleningen)
        │  alle gegevens blijven hier, in Google
        ▼
Google Apps Script (de code in de map apps-script/)
        │  publiceert een "web-app": een adres dat gegevens doorgeeft
        ▼
GitHub Pages (index.html, boeken.html, over-ons.html, balie.html, bestuur.html)
           de schermen die je in de browser ziet
```

- **Alles is gratis**: een Google-spreadsheet met Apps Script, en GitHub Pages.
- **Alle gegevens blijven in Google.** Deze repository is publiek en bevat enkel code. Er komen hier nooit gegevens van boeken, leners of schenkers in. Ook de tests en de voorbeelden gebruiken verzonnen gegevens.
- De publieke catalogus vraagt de web-app enkel de publieke velden. Die bewaart het script een tijdje (tot 6 uur) in zijn geheugen, zodat 2.500 boeken snel laden. Bij elke uitlening en elke wijziging in de spreadsheet ververst dat geheugen vanzelf.

## 3. Een kopie van de stockspreadsheet maken en het script installeren

> Werk altijd eerst op een **kopie**. Het origineel blijft intact tot alles getest is.

**De kopie maken**

1. Open de stockspreadsheet in Google Drive, met het Google-account van het vrijwilligersrooster.
2. Kies **Bestand > Een kopie maken**. Noem de kopie bijvoorbeeld `Madrigal catalogus`.
3. Zet de tijdzone van de spreadsheet goed: **Bestand > Instellingen > Tijdzone**, kies `(GMT+01:00) Brussel` en klik op **Instellingen opslaan**. Anders kloppen de datums en tijdstippen niet.
4. Deel de kopie **enkel met het bestuur**. Ze bevat straks leners en contactgegevens. Deel ze niet met alle vrijwilligers: zij werken via het uitleenscherm.

**Het script installeren**

1. Open de kopie. Kies **Extensies > Apps Script**. Er opent een nieuw venster met een bestand `Code.gs`.
2. Klik links op het tandwiel **Projectinstellingen**. Zie je links enkel icoontjes? Ga er met de muis over, dan verschijnen de namen.
   - Zet de **tijdzone** op `(GMT+01:00) Brussel`. Dat is de enige instelling die je hier nodig hebt.
   - Zie je ook een vakje **"appsscript.json-manifestbestand weergeven in editor"**? Dan mag je het aanvinken en in de Editor de inhoud van `appsscript.json` vervangen door die van [`apps-script/appsscript.json`](apps-script/appsscript.json). Zie je het vakje niet? Sla het dan over. Het script werkt ook zonder.
3. Ga terug naar de **Editor** (het icoon `< >`).
4. Open op GitHub het bestand [`madrigal-script.gs`](madrigal-script.gs). Daarin staat alle code in één bestand.
   - Klik rechtsboven op het icoon **Copy raw file** (twee blaadjes over elkaar). Nu staat alles in je klembord.
   - Ga terug naar Apps Script en klik in `Code.gs`.
   - Selecteer alles wat er staat (Ctrl+A, op een Mac Cmd+A) en plak (Ctrl+V, op een Mac Cmd+V).
5. Klik op **Opslaan** (het diskette-icoon).
6. Ga terug naar de spreadsheet en **vernieuw** de pagina. Na een paar seconden verschijnt het menu **Madrigal**.

**Installeren**

1. Kies **Madrigal > 1. Installeer tabbladen**. Zie je het menu niet? Kies dan in Apps Script bovenaan, naast **Uitvoeren**, de functie **installeer** en klik op **Uitvoeren**.
2. De eerste keer vraagt Google om toestemming. Kies je account, klik op **Geavanceerd** en daarna op **Ga naar ... (onveilig)**. Dat "onveilig" betekent enkel dat Google het script niet zelf nagekeken heeft. Het is jouw eigen script.
3. De tabbladen **Instellingen, Catalogus, Onderwerpen, Leners, Uitleningen, Reservaties, Uitzonderingen, Na te kijken** en **Logboek** verschijnen. Stock, Zines, Sheet2 en Sheet3 blijven ongemoeid.
4. Open het tabblad **Instellingen**. De codes voor de balie en het bestuur zijn willekeurig aangemaakt. Pas ze aan als je wil, en kijk de teksten na (welkom, uitleg over lenen, privacy, herinneringen). Vul in de privacytekst het mailadres van het bestuur in.

Je mag "Installeer tabbladen" later opnieuw uitvoeren. Bestaande tabbladen, gegevens en instellingen blijven staan. Enkel wat ontbreekt, komt erbij.

## 4. De Goodreads-export maken en als tabblad plakken

Goodreads heeft voor niche-titels vaak completere gegevens. Er is geen open koppeling meer, dus je maakt een export.

1. Meld je aan op Goodreads met het account van de shelf.
2. Ga naar **My Books**. Klik links onderaan op **Import and export**.
3. Klik op **Export Library**. Na even wachten verschijnt een link naar een CSV-bestand. Download het.
4. Maak in de spreadsheet een nieuw tabblad met precies de naam **`Goodreads-export`**.
5. Klik in dat tabblad op cel A1. Kies **Bestand > Importeren > Uploaden**, kies het CSV-bestand, en kies **"Huidige blad vervangen"**.
6. Zet in het tabblad **Instellingen** bij `goodreads_shelf` de naam van de Madrigal-shelf, precies zoals op Goodreads. De export bevat je volledige bibliotheek: met deze instelling gebruikt het script enkel de boeken op die shelf.
7. Verwijder het tabblad `Goodreads-export` nadat je "Vul aan uit Goodreads" uitvoerde. Het bevat ook de rest van je persoonlijke bibliotheek, met je beoordelingen.
8. Bewaar het CSV-bestand niet in deze repository.

Goed om te weten: de export van Goodreads bevat geen taal en geen beschrijving. Die vult Open Library later aan.

## 5. De catalogus opbouwen: de functies in volgorde

Voer de functies uit via het menu **Madrigal**, in deze volgorde. Elke functie mag je meermaals uitvoeren: er komt niets dubbel, en wat je met de hand verbeterde, blijft staan.

**Stap 1. Madrigal > 2. Bouw de catalogus uit Stock en Zines**

- Leest Stock en Zines en schrijft één nette lijst naar het tabblad **Catalogus**.
- Slaat lege rijen en herhaalde kopregels over. Negeert het selectievakje in kolom A.
- Maakt ISBN's netjes: spaties en streepjes weg, ISBN-10 wordt ISBN-13, het controlecijfer wordt nagekeken. Een ongeldig ISBN komt in de kolom `isbn_origineel`, zodat je het kan nakijken.
- Maakt taal, uitvoering en ja/nee eenvormig.
- Geeft elk boek een vaste **boek-ID** (B0001, B0002, ... en Z0001 voor zines). Die verandert nooit.
- Zet de herkomst in een aparte kolom die nooit publiek wordt. Staat er "niet op site" in de herkomst, dan krijgt het boek `publiek = nee`.
- Zines met genre "verkoop" krijgen `uitleenbaar = nee`.
- Vult de vertaaltabel **Onderwerpen** met alle genres.

**Stap 2. Madrigal > 3. Vul aan uit Goodreads**

- Koppelt eerst op ISBN, anders op titel en achternaam van de auteur.
- Vult enkel **lege** velden aan: uitgeverij, jaartal en pagina's. Bestaande waarden worden nooit overschreven.
- Staat er al een waarde in de Catalogus, dan wint de Catalogus altijd: de stocklijst beschrijft het boek in de kast.
- Naar **Na te kijken** gaan enkel een koppeling op alleen de titel (de auteur verschilt), en een ISBN uit Goodreads voor boeken zonder ISBN. Zet zo'n ISBN enkel in de Catalogus als het klopt met jouw uitgave.

**Stap 3. Madrigal > 4. Vul aan uit Open Library**

- Zoekt voor boeken met een ISBN op wat nog ontbreekt (uitgeverij, jaartal, pagina's, taal, beschrijving) en een link naar de cover.
- Een script mag hoogstens 6 minuten draaien. Daarom werkt dit in porties: na ongeveer 4,5 minuten stopt het en gaat het een minuut later vanzelf verder. Bij 2.500 boeken duurt dat ongeveer een half uur. Je hoeft niets te doen. Rechtsonder verschijnt telkens een melding.
- Het script wacht tussen twee opvragingen, zoals Open Library vraagt.
- Elk opgezocht boek krijgt een datum in de kolom `ol_gecontroleerd`. Wil je een boek opnieuw laten opzoeken? Maak die cel leeg.

**Stap 3b. Ontbrekende covers bij Google Books (vanzelf)**

- Zodra Open Library klaar is, start het script vanzelf **5. Zoek ontbrekende covers bij Google Books**. Je kan het ook zelf starten via het menu.
- Het zoekt enkel bij boeken met een ISBN die nog geen cover hebben, en vult daarnaast enkel lege velden aan.
- Zonder sleutel staat Google een beperkt aantal opvragingen per dag toe. Is die limiet bereikt, dan gaat het script 6 uur later vanzelf verder. Het Logboek toont de stand.
- Wil je het sneller? Maak een gratis sleutel voor de Google Books-API in de Google Cloud Console en zet ze in Instellingen bij `google_books_api_key`. Dat is niet nodig.
- Elk opgezocht boek krijgt een datum in de kolom `gb_gecontroleerd`. Maak die cel leeg om een boek opnieuw te laten opzoeken.

**Stap 3c. Ontbrekende beschrijvingen (vanzelf)**

- Zodra Google Books klaar is, start het script vanzelf **6. Zoek ontbrekende beschrijvingen**. Je kan het ook zelf starten via het menu.
- Het zoekt een beschrijving voor elk boek met een ISBN waar de kolom `beschrijving` leeg is: eerst bij Google Books, daarna bij Open Library.
- Goodreads geeft geen beschrijvingen: niet in de export, en Goodreads heeft geen open API meer.
- De beschrijving staat in de taal van de bron, meestal Engels. Een beschrijving die je zelf invult of verbetert, overschrijft het script nooit.
- Zines en boeken zonder ISBN vul je zelf in.
- Is de daglimiet van Google op, dan zoekt het script verder bij Open Library en probeert het Google 6 uur later opnieuw. Met een `google_books_api_key` gebeurt dat zelden.
- Elk opgezocht boek krijgt een datum in de kolom `beschrijving_gezocht`. Maak die cel leeg om opnieuw te laten zoeken.

**Stap 4. Het tabblad Na te kijken afwerken**

Loop de rijen één voor één af:

- Klopt de waarde uit de bron (kolom `waarde_bron`)? Zet ze dan zelf in de Catalogus.
- Klopt de waarde in de Catalogus? Laat ze staan.
- Zet daarna in de kolom `afgehandeld` een **ja**.

De Catalogus is nu de enige bron. Stock en Zines heb je niet meer nodig.

**Wat staat er in de Catalogus?**

| Kolom | Betekenis |
| --- | --- |
| `boek_id` | vaste ID, nooit wijzigen |
| `soort` | boek of zine |
| `titel`, `auteur`, `isbn`, `uitgeverij`, `jaartal`, `taal`, `paginas`, `uitvoering` | de gegevens van het boek |
| `nieuwstaat` | ja = nieuw, nee = tweedehands |
| `aanrader` | de voornaam van wie het boek aanraadt. Wordt het label "Aanrader van ..." |
| `genre` | het oorspronkelijke genre, vertaald via Onderwerpen |
| `extra_onderwerpen` | extra filtergroepen voor dit boek, gescheiden door komma's |
| `klassieker` | zet **ja** om het boek in de filtergroep Klassiekers te zetten |
| `aantal` | aantal exemplaren (leeg = 1). Exemplaren heten B0012-1, B0012-2, ... |
| `uitleenbaar` | nee = niet uitleenbaar (bv. zines te koop) |
| `publiek` | nee = niet zichtbaar in de publieke catalogus, wel uitleenbaar aan de balie |
| `beschrijving`, `cover_url` | korte beschrijving en link naar de cover |
| `startpagina` | leeg = automatisch, **ja** = altijd bij de Aanraders op de startpagina, **nee** = nooit |
| `toegevoegd_op` | de dag waarop het boek in de Catalogus kwam. Het script vult dit zelf in. |
| `herkomst` (grijs) | **nooit publiek**: donatie, bruikleen, gift, schenker, interne notities |
| `isbn_origineel`, `bron_sleutel`, `ol_gecontroleerd` (grijs) | hulpkolommen voor het script |

Schrijf het etiket op elk boek met het **exemplaarnummer** (bijvoorbeeld `B0012-1`). Aan de balie zoek je daar het snelst op.

## 6. De vertaaltabel Onderwerpen nakijken

De filters op de website gebruiken **filtergroepen**: Gender, Seksualiteit, Feminisme, Fictie, Klassiekers, Geschiedenis en maatschappij, Biografie, Poëzie, Graphic novel, Young adult, Pulp, Erotica en BDSM, Zines.

Het tabblad **Onderwerpen** vertaalt elk genre uit de stocklijst naar een of meer filtergroepen:

| genre | filtergroepen | aantal_boeken |
| --- | --- | --- |
| Young adult | Young adult | 34 |
| erotica | Erotica en BDSM | 12 |
| roman lesbisch | Fictie, Seksualiteit | 51 |

- Het script stelt zelf een filtergroep voor. **Kijk elke rij na** en pas aan waar nodig. Meerdere groepen scheid je met een komma.
- Varianten in schrijfwijze (erotica en Erotica) staan samen op één rij.
- "Klassiekers" bestaat niet als genre: zet in de Catalogus **ja** in de kolom `klassieker`.
- Een boek in een extra groep zetten? Gebruik de kolom `extra_onderwerpen` in de Catalogus.
- Een nieuwe filtergroep maken? Typ gewoon een nieuwe naam in de kolom `filtergroepen`. Ze verschijnt vanzelf op de website.
- Komen er nieuwe genres bij? Kies **Madrigal > Werk de vertaaltabel Onderwerpen bij**.

## 7. Lopende uitleningen overnemen uit het oude uitleenblad

Het oude digitale uitleenblad bevat persoonsgegevens. Neem **enkel de lopende uitleningen** over. De historiek blijft in het oude blad.

1. **Kies een vaste datum** waarop het papieren uitleenblad en het oude digitale blad stoppen, bijvoorbeeld een vrijdag. Spreek die af met het bestuur en de vrijwilligers.
2. Zorg dat het oude blad bijgewerkt is: elk teruggebracht boek heeft een datum in "boek terug op...".
3. Kies in de nieuwe spreadsheet **Madrigal > Neem lopende uitleningen over uit het oude blad**.
4. Plak de link naar het oude uitleenblad en klik op **OK**.
5. Het script:
   - neemt enkel rijen zonder datum in "boek terug op..." over.
   - zoekt het boek in de Catalogus op titel en auteur, met een tolerante vergelijking.
   - maakt per persoon één lener aan, ook als die meerdere boeken heeft (herkend op e-mail of telefoon).
   - neemt de borg, de betaalwijze, de afgesproken terugbrengdatum en de laatste herinnering mee.
6. Kijk het tabblad **Na te kijken** na. Twijfelgevallen (bron "Overzetten") vermelden het lenersnummer, de datums en de borg. Registreer die uitleningen zelf via het uitleenscherm.
7. Overgenomen leners hebben `toestemming_privacy = onbekend`. Vraag hun toestemming bij het volgende bezoek en zet dan **ja** in het tabblad Leners.
8. Vanaf de afgesproken datum gebruikt iedereen enkel nog het uitleenscherm. Zet het oude blad op "alleen lezen" en verwijder het na de bewaartermijn.

Je mag deze functie opnieuw uitvoeren: wat al overgenomen is, komt er niet dubbel in.

## 8. Het script publiceren als web-app

1. Open in de spreadsheet **Extensies > Apps Script**.
2. Klik rechtsboven op **Implementeren > Nieuwe implementatie**.
3. Klik op het tandwiel naast "Type selecteren" en kies **Web-app**.
4. Vul in:
   - Beschrijving: `Catalogus Madrigal`
   - Uitvoeren als: **Ik** (jouw account)
   - Wie heeft toegang: **Iedereen**
5. Klik op **Implementeren** en geef toestemming als Google erom vraagt.
6. Kopieer de **URL van de web-app**. Ze eindigt op `/exec`.
7. Open op GitHub het bestand [`config.js`](config.js), klik op het potlood (**Edit**), en plak de URL tussen de aanhalingstekens:

   ```js
   apiUrl: 'https://script.google.com/macros/s/.../exec',
   ```

8. Klik op **Commit changes**. Na een minuut toont de website de echte catalogus.

"Iedereen" betekent: iedereen kan het **publieke** deel opvragen. De afgeschermde delen vragen een code (zie [privacy en veiligheid](#13-privacy-en-veiligheid)).

## 9. GitHub Pages aanzetten

1. Ga op GitHub naar de repository **catalogus** van de organisatie.
2. Klik op **Settings > Pages**.
3. Bij "Build and deployment": kies **Source: Deploy from a branch**, branch **main**, map **/ (root)**. Klik op **Save**.
4. Na een paar minuten staat de website online op `https://projectmadrigal.github.io/catalogus/`. De catalogus staat op `boeken.html`.
   - Het uitleenscherm: `https://projectmadrigal.github.io/catalogus/balie.html`
   - Het bestuursscherm: `https://projectmadrigal.github.io/catalogus/bestuur.html`

Het adres hangt af van de naam van de organisatie op GitHub. Heet die anders, dan staat die naam vooraan in het adres.

**Op het beginscherm zetten.** Open de catalogus op een smartphone en kies in het menu van de browser **Toevoegen aan beginscherm**. Doe dat op de smartphone van de balie ook voor `balie.html`.

## 10. Een nieuw boek toevoegen

1. Open het tabblad **Catalogus**.
2. Voeg onderaan een rij toe. Vul minstens het **ISBN** in, liefst ook titel en auteur. Laat `boek_id` leeg.
3. Zet bij een zine `zine` in de kolom `soort`.
4. Kies **Madrigal > Nieuwe boeken verwerken**. Het script:
   - geeft het boek een boek-ID.
   - maakt ISBN, taal en uitvoering netjes.
   - vult aan uit Goodreads (als dat tabblad er nog is) en uit Open Library.
5. Kijk het genre, de filtergroepen en eventueel **Na te kijken** na.
6. Schrijf het exemplaarnummer op het etiket.

**Zelf een cover toevoegen.** Vond geen enkele bron een cover? Zoek het boek online op, bijvoorbeeld op Goodreads of de website van de uitgeverij. Klik met de rechtermuisknop op de cover en kies **Afbeeldingsadres kopiëren**. Plak dat adres in de kolom `cover_url` van het boek. Het adres moet beginnen met `https://`. Een cover die je zelf invult, overschrijft het script nooit.

Een extra exemplaar van een boek dat er al is? Verhoog het getal in de kolom `aantal`.

Een boek uit de publieke catalogus halen zonder het te verwijderen? Zet `publiek` op **nee**.

## 11. Werken aan de balie

Druk de handleiding af: open **`handleiding-balie.html`** en klik op **Afdrukken**. Ze past op één A4. Leg ze naast de balie.

Kort:

- Open `balie.html`. De eerste keer vul je de code van de balie en je voornaam in. Het toestel onthoudt de code.
- **Uitlenen**: boek zoeken, exemplaar kiezen, lener kiezen, borg aanduiden, bevestigen. De terugbrengdatum verschijnt groot.
- **Terugbrengen**: boek of lener zoeken, borg aanduiden, bevestigen. Moet het boek apart liggen voor een reservatie, dan zegt het scherm dat.
- **Verlengen**, **Reserveren**, **Lener opzoeken** en **Nieuwe lener** werken op dezelfde manier.
- De vervaldatum is altijd 4 weken na de uitleendatum, opgeschoven naar de eerstvolgende vrijdag waarop de bib open is. Gesloten vrijdagen zet je in Instellingen bij `gesloten_data`, bijvoorbeeld `25/12/2026, 1/1/2027`.

## 12. Na een wijziging in het script: een nieuwe versie publiceren

Pas je iets aan in de code van Apps Script, dan ziet de web-app dat pas na een nieuwe versie.

1. Kopieer opnieuw het volledige bestand `madrigal-script.gs` van GitHub, vervang alles in `Code.gs` en klik op **Opslaan**.
2. Klik op **Implementeren > Implementaties beheren**.
3. Klik op het **potlood** bij je web-app.
4. Kies bij Versie: **Nieuwe versie**. Klik op **Implementeren**.

De URL blijft dezelfde. Je hoeft `config.js` niet aan te passen.

Een wijziging in de **spreadsheet** (een boek, een instelling, een tekst) vraagt geen nieuwe versie. Die is meteen actief.

Een grens toevoegen of wijzigen? Alles staat in [`apps-script/Grenzen.js`](apps-script/Grenzen.js), met uitleg bovenaan.

## 13. Privacy en veiligheid

**Welke gegevens bewaren we?** Van een lener enkel: voornaam, eventueel achternaam, telefoon en/of e-mail, de datum van inschrijving, de toestemming en een lenersnummer. Niets meer.

**Wie ziet wat?**

| Wie | Ziet |
| --- | --- |
| Iedereen (publieke catalogus) | boeken en hun beschikbaarheid, nooit leners, herkomst of notities |
| Vrijwilligers (balie) | voornaam en lenersnummer, nooit contactgegevens |
| Bestuur (bestuursscherm en spreadsheet) | ook contactgegevens, borgen en uitzonderingen |

**Hoe lang?** Elke nacht om 3 uur draait een opruiming:

- 12 maanden nadat een boek terug is, wist het script de koppeling tussen de uitlening en de lener. De uitlening blijft voor de cijfers, zonder lener.
- Een lener die op **inactief** staat, niets meer in huis heeft en 12 maanden niets leende, wordt volledig gewist.
- De termijn staat in Instellingen bij `bewaartermijn_afgesloten_uitleningen_maanden`.

Wil iemand zijn gegevens laten wissen? Zet de lener op inactief in het bestuursscherm. Moet het meteen? Verwijder de rij in het tabblad Leners, nadat alle boeken terug zijn.

**De codes zijn een eenvoudige drempel, geen echte beveiliging.** Ze houden nieuwsgierigen weg, maar wie de code kent, komt binnen. Daarom:

- Geef de code van het bestuur enkel aan het bestuur.
- Wijzig een code in Instellingen als ze uitlekt, of als een vrijwilliger stopt. Op de toestellen moet je dan opnieuw aanmelden.
- Deel de spreadsheet enkel met het bestuur.
- Het script controleert elke invoer en elke code, en wacht even bij een verkeerde code.

**Geen gegevens in deze repository.** Zet hier nooit exports, schermafdrukken met namen, of kopieën van de spreadsheet. Het bestand `.gitignore` houdt CSV- en Excel-bestanden al tegen.

## 14. Wat te doen als iets niet werkt

| Wat je ziet | Wat je doet |
| --- | --- |
| "Je ziet verzonnen voorbeeldboeken" | `apiUrl` in `config.js` is leeg. Zie [stap 8](#8-het-script-publiceren-als-web-app). |
| "De catalogus kon niet laden" | Kijk of de URL in `config.js` klopt en eindigt op `/exec`. Kijk of de web-app op "Iedereen" staat. |
| Een wijziging in de spreadsheet verschijnt niet op de website | Kies **Madrigal > Ververs de publieke catalogus** en vernieuw de website. |
| "De code klopt niet" | Kijk de code na in Instellingen (hoofdletters tellen mee). |
| Een wijziging in het script werkt niet | Publiceer een nieuwe versie, zie [stap 12](#12-na-een-wijziging-in-het-script-een-nieuwe-versie-publiceren). |
| Het menu Madrigal verschijnt niet | Wacht 20 seconden na het vernieuwen. Ben je met meerdere Google-accounts aangemeld? Open de spreadsheet in een privévenster met enkel het Madrigal-account. Kijk in Apps Script of de code opgeslagen is zonder rode foutmelding. Lukt het nog niet? Start **installeer** rechtstreeks in Apps Script. |
| "Het tabblad Catalogus bestaat niet" | Je startte in Apps Script een andere functie dan **installeer**. Kies **installeer** in de keuzelijst naast **Uitvoeren**. |
| Open Library stopt halverwege | Normaal: het gaat na een minuut vanzelf verder. Staat het al lang stil? Kies opnieuw **Vul aan uit Open Library**. |
| "Er ging iets mis: ..." | Kijk in het tabblad **Logboek** en in Apps Script bij **Uitvoeringen** (links, het lijstje). |
| Iets anders | Kijk in het Logboek. Noteer wat je deed en wat je zag, en geef dat aan de beheerder. |

Aan de balie zonder internet: noteer op papier de datum, het exemplaarnummer, het lenersnummer, de borg en de betaalwijze. Geef het briefje aan het bestuur.

## 15. Waar alles staat, voor een volgende beheerder

**In Google (het account van het vrijwilligersrooster)**

- De spreadsheet `Madrigal catalogus`: alle gegevens.
- Het Apps Script-project, via Extensies > Apps Script in die spreadsheet.
- De web-app: Implementeren > Implementaties beheren.
- Twee geplande taken (Apps Script > Triggers, het wekkertje): `ruimOp` elke nacht, en `bijWijziging` bij elke wijziging.

**In deze repository**

| Bestand | Wat erin staat |
| --- | --- |
| `index.html`, `home.js` | de startpagina: nieuws, agenda, aanraders, vragen, adres |
| `boeken.html`, `app.js` | de publieke catalogus |
| `over-ons.html` | de pagina Over ons (tekst rechtstreeks in de HTML, in het Nederlands en het Engels) |
| `layout.js` | de kop (menu, taal, donkere modus) en de voet van elke publieke pagina |
| `i18n.js` | alle vaste teksten van de website in het Nederlands en het Engels |
| `404.html` | stuurt adressen van de oude website door (bv. `/boeken`) |
| `assets/` | logo, lettertype (Geist Mono) en foto's |
| `zoeken.js` | zoeken met tikfouten, zonder hoofdletters, accenten en lidwoorden |
| `filters.js` | de filters en het sorteren (een filter toevoegen: zie uitleg bovenaan) |
| `balie.html`, `balie.js` | het uitleenscherm |
| `bestuur.html`, `bestuur.js` | het bestuursscherm |
| `beheer.js` | gedeeld door balie en bestuur: aanmelden, grenzen, statuslabels |
| `api.js` | praat met de web-app |
| `dom.js` | kleine hulpfuncties om pagina's te bouwen |
| `config.js` | de URL van de web-app |
| `styles.css` | kleuren, lettertypes en opmaak (variabelen bovenaan) |
| `manifest.json`, `icons/` | om de site op het beginscherm te zetten |
| `handleiding-balie.html` | handleiding van één pagina om af te drukken |
| `voorbeeld/catalogus.json`, `voorbeeld/site.json` | verzonnen voorbeeldboeken en -nieuws, voor als de web-app nog niet gekoppeld is |
| `apps-script/` | alle code van Google Apps Script |
| `madrigal-script.gs` | dezelfde code in één bestand, om in Apps Script te plakken. Pas het niet met de hand aan. |
| `tools/bundel.js` | maakt `madrigal-script.gs` opnieuw na een wijziging in `apps-script/` |
| `tests/` | tests met verzonnen gegevens |

**De Apps Script-bestanden**

| Bestand | Wat erin staat |
| --- | --- |
| `Menu.js` | het menu Madrigal en de installatie |
| `Instellingen.js` | standaardwaarden en uitleg van de instellingen |
| `Catalogus.js` | opbouw van de Catalogus en de vertaaltabel Onderwerpen |
| `Goodreads.js`, `OpenLibrary.js` | aanvullen uit Goodreads en Open Library |
| `GoogleBooks.js`, `Beschrijvingen.js` | covers uit Google Books, beschrijvingen uit Google Books en Open Library |
| `Grenzen.js` | **de grenzen**, met uitleg om er een toe te voegen |
| `Uitlenen.js` | uitlenen, terugbrengen, verlengen, reserveren, leners |
| `Datums.js` | vervaldatums, openingsdagen en statusteksten |
| `Publiek.js` | welke velden publiek zijn |
| `Bestuur.js` | gegevens voor het uitleenscherm en het bestuursscherm |
| `Privacy.js` | de nachtelijke opruiming |
| `Overzetten.js` | eenmalig: lopende uitleningen uit het oude blad |
| `Api.js` | de web-app: het publieke en de afgeschermde eindpunten |
| `Site.js` | de inhoud van de startpagina (`?actie=site`) |
| `OudeSite.js` | eenmalig: nieuws, agenda en vragen overnemen van de oude website |
| `Opslag.js` | lezen en schrijven van de tabbladen |
| `Hulp.js` | hulpfuncties voor tekst, ISBN en datums |

**De tests uitvoeren** (voor wie de code aanpast): installeer [Node.js](https://nodejs.org) en voer in deze map uit:

```
node tests/run.js
```

Pas je iets aan in `apps-script/`? Voer dan eerst `node tools/bundel.js` uit, zodat `madrigal-script.gs` mee verandert. Alle tests moeten "ok" tonen. GitHub voert ze ook automatisch uit bij elke wijziging (zie het tabblad **Actions**).

## 16. De website: nieuws, agenda, vragen en Engelse teksten

De website heeft de opmaak van de oude website (projectmadrigal.be), maar alle inhoud komt uit de spreadsheet. Je hebt geen aparte beheeromgeving meer nodig.

**De tabbladen.** `installeer` maakt drie tabbladen aan:

| Tabblad | Kolommen |
| --- | --- |
| **Nieuws** | `datum`, `titel`, `titel_en`, `tekst`, `tekst_en`, `afbeelding`, `link`, `publiek` |
| **Agenda** | `datum`, `uur`, `titel`, `titel_en`, `tekst`, `tekst_en`, `locatie`, `afbeelding`, `link`, `publiek` |
| **Veelgestelde vragen** | `volgorde`, `vraag`, `vraag_en`, `antwoord`, `antwoord_en`, `publiek` |

- De startpagina toont de 3 nieuwste berichten, de 3 volgende events en het vorige event.
- Zet **nee** in `publiek` om een rij te verbergen zonder ze te wissen.
- `afbeelding` en `link` zijn volledige adressen die met `https://` beginnen.
- Laat je een kolom op `_en` leeg, dan toont de Engelse versie de Nederlandse tekst.
- De kolom `bron_id` vult het script zelf in. Laat die staan.

**Overnemen van de oude website.** Kies in het menu **Madrigal > Neem nieuws, agenda en vragen over van de oude website**. Het script haalt alles op en zet het in de drie tabbladen. Opnieuw uitvoeren maakt niets dubbel. Kijk de teksten daarna na: opmaak zoals vet en links verdwijnt. De afbeeldingen blijven op de server van de oude website staan. Zet ze op een andere plaats voor je die server opzegt, en pas de link in de kolom `afbeelding` aan.

**Instellingen voor de website.** In het tabblad Instellingen:

| Instelling | Wat |
| --- | --- |
| `adres` | het adres, elke regel op een nieuwe lijn (Alt+Enter in een cel) |
| `openingsuren`, `openingsuren_en` | de openingsuren zoals ze op de startpagina staan |
| `mail_algemeen`, `mail_events` | de mailadressen onder "Kom eens langs" |
| `aanraders_verbergen` | namen van wie de aanraders niet op de startpagina staan |
| `nieuw_op_startpagina_dagen` | hoeveel dagen een nieuw boek bij de Aanraders staat (0 = nooit automatisch) |
| `tekst_welkom_en`, `tekst_uitleg_lenen_en`, `tekst_privacy_en` | de Engelse versie van de teksten op de pagina Boeken |

**Aanraders.** De startpagina toont tot 12 boeken uit de Catalogus. Beschikbare boeken komen eerst, de volgorde wisselt elke dag. Een boek komt in aanmerking als:

- iemand het aanraadt: er staat een naam in de kolom `aanrader`. Het label wordt "Aanrader van ...".
- het nieuw binnen is: het kwam minder dan `nieuw_op_startpagina_dagen` dagen geleden in de Catalogus (standaard 60). Het label wordt "Nieuw binnen". Boeken van de eerste opbouw tellen niet als nieuw.
- je zelf **ja** zet in de kolom `startpagina`.

Zet je **nee** in de kolom `startpagina`, dan staat het boek nooit op de startpagina, ook niet als het nieuw is of iemand het aanraadt.

Wil je de aanraders van iemand tijdelijk niet op de startpagina? Zet die naam in de instelling `aanraders_verbergen` (meerdere namen gescheiden door komma's). Het label en de filter in de catalogus blijven. Wis de naam om ze terug te tonen.

**Vaste teksten en de pagina Over ons.** De knoppen, menu's en titels staan in `i18n.js`. De tekst van Over ons staat rechtstreeks in `over-ons.html`, met een blok `data-taal="nl"` en een blok `data-taal="en"`. Pas je de ene taal aan, pas dan ook de andere aan.

**Na een wijziging in het script** publiceer je een nieuwe versie van de web-app (zie [hoofdstuk 12](#12-na-een-wijziging-in-het-script-een-nieuwe-versie-publiceren)). Anders kent de web-app `?actie=site` niet en blijft de startpagina leeg.

**Het eigen domein projectmadrigal.be.** Wil je dat projectmadrigal.be naar deze website wijst:

1. Ga op GitHub naar **Settings > Pages > Custom domain**, vul `www.projectmadrigal.be` in en klik op **Save**.
2. Pas bij je domeinregistrar de DNS aan: een `CNAME`-record voor `www` naar `projectmadrigal.github.io`, en voor het domein zonder www de vier `A`-records van GitHub Pages (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`).
3. Vink **Enforce HTTPS** aan zodra GitHub dat toelaat (dat duurt soms een dag).

Doe dit pas als de nieuwe website klaar is: vanaf dat moment toont projectmadrigal.be de nieuwe website en niet langer de oude.
