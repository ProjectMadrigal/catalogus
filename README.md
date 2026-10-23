# Project Madrigal: website, catalogus en uitleensysteem

Project Madrigal is een queer bibliotheek in Antwerpen, gedragen door vrijwilligers. Deze handleiding is geschreven voor vrijwilligers en bestuursleden **zonder technische kennis**. Je hebt niets te installeren: alles gebeurt in je browser, in de Google-spreadsheet en op GitHub.

| Scherm | Voor wie | Adres |
| --- | --- | --- |
| **Startpagina** | iedereen: nieuws, agenda, aanraders, veelgestelde vragen, adres | https://projectmadrigal.github.io/ |
| **Boeken** (de catalogus) | iedereen, zonder account | https://projectmadrigal.github.io/boeken.html |
| **Over ons** | iedereen | https://projectmadrigal.github.io/over-ons.html |
| **Uitleenscherm** | vrijwilligers aan de balie (met code) | https://projectmadrigal.github.io/balie.html |
| **Bestuursscherm** | het bestuur (met een aparte code) | https://projectmadrigal.github.io/bestuur.html |
| **Rooster** | vrijwilligers en planner (aparte tool) | https://projectmadrigal.github.io/rooster/ |

Daarnaast is er een **handleiding van één pagina** voor de balie, om af te drukken: [`handleiding-balie.html`](handleiding-balie.html).

**Nieuw hier?** Lees eerst [Deel A: dagelijks gebruik](#deel-a-dagelijks-gebruik). Deel C beschrijft de installatie: die is al gebeurd, je hebt ze enkel nodig om alles opnieuw op te zetten.

## Inhoud

**Deel A. Dagelijks gebruik**

1. [Waar staat wat](#a1-waar-staat-wat)
2. [Een nieuw boek toevoegen](#a2-een-nieuw-boek-toevoegen)
3. [Aanraders en nieuwe boeken op de startpagina](#a3-aanraders-en-nieuwe-boeken-op-de-startpagina)
4. [Nieuws, agenda en veelgestelde vragen](#a4-nieuws-agenda-en-veelgestelde-vragen)
5. [Teksten, adres en openingsuren aanpassen](#a5-teksten-adres-en-openingsuren-aanpassen)
6. [Werken aan de balie](#a6-werken-aan-de-balie)
7. [Het bestuursscherm](#a7-het-bestuursscherm)
8. [Wat te doen als iets niet werkt](#a8-wat-te-doen-als-iets-niet-werkt)

**Deel B. Achtergrond**

1. [Wat de tool doet](#b1-wat-de-tool-doet)
2. [Hoe het in elkaar zit](#b2-hoe-het-in-elkaar-zit)
3. [Privacy en veiligheid](#b3-privacy-en-veiligheid)
4. [Woordenlijst](#b4-woordenlijst)

**Deel C. Eenmalige installatie (al gebeurd)**

1. [De spreadsheet en het script installeren](#c1-de-spreadsheet-en-het-script-installeren)
2. [De catalogus opbouwen](#c2-de-catalogus-opbouwen)
3. [De vertaaltabel Onderwerpen nakijken](#c3-de-vertaaltabel-onderwerpen-nakijken)
4. [Lopende uitleningen overnemen uit het oude uitleenblad](#c4-lopende-uitleningen-overnemen-uit-het-oude-uitleenblad)
5. [Het script publiceren als web-app](#c5-het-script-publiceren-als-web-app)
6. [De website online zetten met GitHub Pages](#c6-de-website-online-zetten-met-github-pages)
7. [Nieuws, agenda en vragen overnemen van de oude website](#c7-nieuws-agenda-en-vragen-overnemen-van-de-oude-website)
8. [Het rooster koppelen](#c8-het-rooster-koppelen)
9. [Het eigen domein projectmadrigal.be](#c9-het-eigen-domein-projectmadrigalbe)

**Deel D. Voor een beheerder**

1. [Een nieuwe versie van het script publiceren](#d1-een-nieuwe-versie-van-het-script-publiceren)
2. [Orde in de spreadsheet](#d2-orde-in-de-spreadsheet)
3. [De website zelf aanpassen](#d3-de-website-zelf-aanpassen)
4. [Waar alles staat](#d4-waar-alles-staat)

---

# Deel A. Dagelijks gebruik

## A1. Waar staat wat

Bijna alles beheer je in **de Google-spreadsheet van de catalogus**, in het Google-account van Madrigal. Deel die spreadsheet enkel met het bestuur: ze bevat leners en contactgegevens.

De tabbladen hebben een kleur per groep:

| Kleur | Tabbladen | Waarvoor |
| --- | --- | --- |
| paars | Uitleningen, Reservaties, Leners, Uitzonderingen | wat de balie registreert. Pas dit enkel aan als je weet wat je doet. |
| geel | Catalogus, Onderwerpen, Na te kijken | de boeken en de filters op de website |
| petrol | Nieuws, Agenda, Veelgestelde vragen | de inhoud van de startpagina |
| zwart | Instellingen, Logboek | teksten, codes, regels, en een logboek van wat het script deed |
| grijs | Stock, Zines, Goodreads-export | de oude bronnen, zelden nodig |

Bovenaan de spreadsheet staat het menu **Madrigal**. Zie je het niet? Vernieuw de pagina en wacht 20 seconden.

**Een wijziging in de spreadsheet staat na een minuut op de website.** Je hoeft niets te publiceren. Zie je ze niet, vernieuw de website dan met **Ctrl+F5** (op een Mac Cmd+Shift+R).

## A2. Een nieuw boek toevoegen

1. Open het tabblad **Catalogus**.
2. Voeg onderaan een rij toe. Vul minstens het **ISBN** in, liefst ook titel en auteur. Laat `boek_id` leeg.
3. Zet bij een zine `zine` in de kolom `soort`.
4. Kies **Madrigal > Nieuwe boeken verwerken**. Het script:
   - geeft het boek een vaste boek-ID (B0001, B0002, ... en Z0001 voor zines);
   - maakt ISBN, taal en uitvoering netjes;
   - zoekt de ontbrekende gegevens, een cover en een beschrijving op bij Goodreads (als dat tabblad er nog is), Open Library en Google Books;
   - vertaalt de beschrijving naar het Nederlands en het Engels;
   - zet het boek 60 dagen bij de Aanraders op de startpagina, met het label "Nieuw binnen".

   Dat opzoeken gebeurt in porties en duurt een paar minuten. Rechtsonder verschijnt telkens een melding. Je hoeft niets te doen.
5. Kijk het genre en de filtergroepen na, en eventueel het tabblad **Na te kijken**.
6. Schrijf het **exemplaarnummer** op het etiket van het boek, bijvoorbeeld `B0012-1`. Aan de balie zoek je daar het snelst op.

**Zelf een cover toevoegen.** Vond het script geen cover? Zoek het boek online op, bijvoorbeeld op Goodreads of de website van de uitgeverij. Klik met de rechtermuisknop op de cover en kies **Afbeeldingsadres kopiëren**. Plak dat adres in de kolom `cover_url`. Het moet beginnen met `https://`. Zonder cover toont de website een gekleurde omslag met de titel.

**Zelf een beschrijving schrijven.** Typ ze in de kolom `beschrijving`. Het script overschrijft nooit wat je zelf invult. Wil je ook een Engelse versie, typ die in `beschrijving_en`, of laat ze leeg en kies **Madrigal > 7. Vertaal de beschrijvingen**.

**Nog meer:**

- Een extra exemplaar van een boek dat er al is? Verhoog het getal in de kolom `aantal`.
- Een boek uit de publieke catalogus halen zonder het te verwijderen? Zet `publiek` op **nee**. Aan de balie kan je het nog uitlenen.
- Een boek dat niet uitgeleend mag worden? Zet `uitleenbaar` op **nee**.
- Een boek in de filtergroep Klassiekers? Zet **ja** in de kolom `klassieker`.

**De kolommen van de Catalogus**

| Kolom | Betekenis |
| --- | --- |
| `boek_id` | vaste ID, nooit wijzigen |
| `soort` | boek of zine |
| `titel`, `auteur`, `isbn`, `uitgeverij`, `jaartal`, `taal`, `paginas`, `uitvoering` | de gegevens van het boek |
| `nieuwstaat` | ja = nieuw, nee = tweedehands |
| `aanrader` | de voornaam van wie het boek aanraadt. Wordt het label "Aanrader van ..." |
| `genre` | het oorspronkelijke genre, vertaald via het tabblad Onderwerpen |
| `extra_onderwerpen` | extra filtergroepen voor dit boek, gescheiden door komma's |
| `klassieker` | **ja** = in de filtergroep Klassiekers |
| `aantal` | aantal exemplaren (leeg = 1). Exemplaren heten B0012-1, B0012-2, ... |
| `uitleenbaar` | nee = niet uitleenbaar (bv. zines te koop) |
| `publiek` | nee = niet zichtbaar op de website, wel uitleenbaar aan de balie |
| `beschrijving`, `beschrijving_en` | korte beschrijving in het Nederlands en het Engels |
| `cover_url` | link naar de cover |
| `startpagina` | leeg = automatisch, **ja** = altijd bij de Aanraders, **nee** = nooit (zie A3) |
| `toegevoegd_op` | de dag waarop het boek in de Catalogus kwam. Het script vult dit zelf in. |
| `herkomst` (grijs) | **nooit publiek**: donatie, bruikleen, gift, schenker, interne notities |
| `isbn_origineel`, `bron_sleutel`, `ol_gecontroleerd`, `gb_gecontroleerd`, `beschrijving_gezocht`, `beschrijving_vertaald` (grijs) | hulpkolommen voor het script. Laat ze staan. Maak een datum leeg om een boek opnieuw te laten opzoeken. |

## A3. Aanraders en nieuwe boeken op de startpagina

De startpagina toont tot 12 boeken in het blok **Aanraders**. Beschikbare boeken komen eerst, de keuze wisselt elke dag. Een boek komt erbij als:

- iemand het aanraadt: zet een voornaam in de kolom `aanrader`. Het label wordt "Aanrader van ...". Meerdere namen scheid je met een komma.
- het nieuw binnen is: het kwam minder dan 60 dagen geleden in de Catalogus. Het label wordt "Nieuw binnen".
- je zelf **ja** zet in de kolom `startpagina`.

Zet je **nee** in de kolom `startpagina`, dan staat het boek nooit op de startpagina.

In het tabblad Instellingen, onder `── STARTPAGINA: AANRADERS ──`:

| Instelling | Wat |
| --- | --- |
| `nieuw_op_startpagina_dagen` | hoeveel dagen een nieuw boek bij de Aanraders staat. 0 = nooit automatisch. |
| `aanraders_verbergen` | namen van wie de aanraders tijdelijk niet op de startpagina staan, bv. `Nance`. Het label en de filter in de catalogus blijven. Wis de naam om ze terug te tonen. |

## A4. Nieuws, agenda en veelgestelde vragen

Elke rij in deze tabbladen is één bericht, event of vraag.

| Tabblad | Kolommen |
| --- | --- |
| **Nieuws** | `datum`, `titel`, `titel_en`, `tekst`, `tekst_en`, `afbeelding`, `link`, `publiek` |
| **Agenda** | `datum`, `uur`, `titel`, `titel_en`, `tekst`, `tekst_en`, `locatie`, `afbeelding`, `link`, `publiek` |
| **Veelgestelde vragen** | `volgorde`, `vraag`, `vraag_en`, `antwoord`, `antwoord_en`, `publiek` |

- De startpagina toont de 3 nieuwste berichten, de 3 volgende events en het vorige event.
- Een nieuwe regel binnen een cel maak je met **Ctrl+Enter** of **Alt+Enter**. De website neemt die regels over.
- De kolommen op `_en` zijn de Engelse versie. Laat je ze leeg, dan toont de Engelse website de Nederlandse tekst.
- `afbeelding` en `link` zijn volledige adressen die met `https://` beginnen.
- `volgorde` bij de vragen: 1, 2, 3, ... Een lege volgorde komt achteraan.
- Zet **nee** in `publiek` om een rij te verbergen zonder ze te wissen.
- Opmaak zoals vet of een klikbare link kan niet: de website toont gewone tekst.
- De kolom `bron_id` vult het script zelf in bij wat van de oude website kwam. **Laat die staan**, anders komt een vraag dubbel als iemand de overname opnieuw uitvoert.

## A5. Teksten, adres en openingsuren aanpassen

**In de spreadsheet, tabblad Instellingen** (meteen actief):

| Wat | Instelling |
| --- | --- |
| Adres en openingsuren onder "Kom eens langs" | `adres`, `openingsuren`, `openingsuren_en` |
| Mailadressen onder "Kom eens langs" | `mail_algemeen`, `mail_events` |
| Welkomst, uitleg over lenen en privacy op de pagina Boeken | `tekst_welkom`, `tekst_uitleg_lenen`, `tekst_privacy` (en de versies op `_en`) |
| De herinneringen die het bestuur kopieert | `tekst_herinnering`, `tekst_herinnering_binnenkort` |
| Uitleentermijn, borg, maximum boeken, verlengingen | onder `── UITLENEN ──` en `── BORG EN GIFTEN ──` |
| Gesloten vrijdagen | `gesloten_data`, bv. `25/12/2026, 1/1/2027` |

**Op GitHub** (vaste teksten van de website):

- De tekst van **Over ons** staat in [`over-ons.html`](over-ons.html), in een Nederlands en een Engels blok. Pas je de ene taal aan, pas dan ook de andere aan.
- Knoppen, menu's en titels staan in [`i18n.js`](i18n.js), eerst alle Nederlandse, dan alle Engelse.

Hoe je een bestand op GitHub aanpast, staat in [D3](#d3-de-website-zelf-aanpassen).

## A6. Werken aan de balie

Druk de handleiding af: open [`handleiding-balie.html`](handleiding-balie.html) en klik op **Afdrukken**. Ze past op één A4. Leg ze naast de balie.

Kort:

- Open het uitleenscherm. De eerste keer vul je de code van de balie en je voornaam in. Het toestel onthoudt de code.
- **Uitlenen**: boek zoeken, exemplaar kiezen, lener kiezen, borg aanduiden, bevestigen. De terugbrengdatum verschijnt groot.
- **Terugbrengen**: boek of lener zoeken, borg aanduiden, bevestigen. Moet het boek apart liggen voor een reservatie, dan zegt het scherm dat.
- **Verlengen**, **Reserveren**, **Lener opzoeken** en **Nieuwe lener** werken op dezelfde manier.
- **Rooster**: wie de komende vrijdagen in de bib staat. Je beschikbaarheid invullen doe je in de roostertool zelf, via de knop onderaan.
- De terugbrengdatum is 4 weken na de uitleendatum, opgeschoven naar de eerstvolgende vrijdag waarop de bib open is.

**Grenzen.** Het scherm waarschuwt bij: meer dan 2 boeken per lener, een tweede verlenging, verlengen terwijl iemand anders wacht, uitlenen aan iemand met een boek te laat, of een boek dat voor iemand anders klaarligt. Je mag zo'n grens bewust overschrijden, maar je vult dan een reden in. Het bestuur ziet die reden.

**Zonder internet?** Noteer op papier de datum, het exemplaarnummer, het lenersnummer, de borg en de betaalwijze. Geef het briefje aan het bestuur.

## A7. Het bestuursscherm

Het bestuursscherm toont:

- wat **te laat** is, met de contactgegevens en een herinnering om te kopiëren of meteen via WhatsApp of mail te versturen;
- wat **binnenkort vervalt**;
- alle lopende uitleningen, de borgen en giften, de reservaties, de uitzonderingen (met de reden), de leners en eenvoudige cijfers;
- het **rooster**.

Verstuurde je een herinnering? Klik op **Herinnering verstuurd**, dan zie je wanneer de laatste herinnering vertrok.

## A8. Wat te doen als iets niet werkt

| Wat je ziet | Wat je doet |
| --- | --- |
| Een wijziging verschijnt niet op de website | Wacht een minuut en vernieuw met **Ctrl+F5**. Helpt dat niet: kies **Madrigal > Ververs de publieke catalogus**. |
| Na een wijziging op GitHub zie je niets | GitHub heeft een paar minuten nodig. Vernieuw daarna met **Ctrl+F5**. |
| De startpagina toont geen nieuws, agenda of aanraders | De web-app draait een oude versie van het script. Publiceer een nieuwe versie, zie [D1](#d1-een-nieuwe-versie-van-het-script-publiceren). |
| "Je ziet verzonnen voorbeeldboeken" | Het adres van de web-app ontbreekt in `config.js`. Zie [C5](#c5-het-script-publiceren-als-web-app). |
| "De catalogus kon niet laden" | Kijk of het adres in `config.js` klopt en eindigt op `/exec`, en of de web-app op "Iedereen" staat. |
| "De code klopt niet" | Kijk de code na in Instellingen. Hoofdletters tellen mee. |
| "Het rooster is nog niet gekoppeld" | Vul `rooster_url` en `rooster_code` in, zie [C8](#c8-het-rooster-koppelen). |
| Het menu Madrigal verschijnt niet | Wacht 20 seconden na het vernieuwen. Ben je met meerdere Google-accounts aangemeld? Open de spreadsheet in een privévenster met enkel het Madrigal-account. |
| "Het tabblad Catalogus bestaat niet" | Je startte in Apps Script een andere functie dan **installeer**. Kies **installeer** in de keuzelijst naast **Uitvoeren**. |
| Het opzoeken van boekgegevens stopt halverwege | Normaal: het gaat na een minuut vanzelf verder. Bij een daglimiet van Google na 6 uur. Het Logboek toont de stand. |
| "Er ging iets mis: ..." | Kijk in het tabblad **Logboek**, en in Apps Script bij **Uitvoeringen** (links, het lijstje). |
| Iets anders | Noteer wat je deed en wat je zag, en geef dat aan de beheerder. |

---

# Deel B. Achtergrond

## B1. Wat de tool doet

**De publieke website**

- Een startpagina met nieuws, agenda, aanraders, veelgestelde vragen en het adres.
- Een catalogus waarin je zoekt op titel, auteur, uitgeverij of ISBN. Tikfouten, hoofdletters, accenten en lidwoorden (de, het, the, le, ...) maken niet uit.
- Filters op onderwerp, taal, nieuw of tweedehands, uitvoering, periode van uitgave, aanrader en "enkel beschikbaar". Sorteren op titel, auteur of jaartal. 30 boeken per pagina.
- Elk boek toont een label: **beschikbaar**, **uitgeleend** (met de verwachte terugkeer), **gereserveerd** of **niet uitleenbaar**. Bij meerdere exemplaren: "1 van 2 beschikbaar". Elk boek heeft een eigen pagina met een vaste link, om te delen.
- Alles in het Nederlands en het Engels, met een lichte en een donkere modus.
- De website toont nooit wie een boek leent, waar een boek vandaan komt, of interne notities.

**Het uitleenscherm** vervangt het papieren uitleenblad en het oude digitale uitleenblad. Een vrijwilliger ziet van een lener enkel de voornaam en het lenersnummer.

**Het bestuursscherm** toont ook contactgegevens, herinneringen, borgen en uitzonderingen.

## B2. Hoe het in elkaar zit

```
Google-spreadsheet van de catalogus (boeken, leners, uitleningen, nieuws, instellingen)
        │  alle gegevens blijven hier, in het Google-account van Madrigal
        ▼
Google Apps Script (een klein programma bij de spreadsheet)
        │  publiceert een "web-app": een adres dat gegevens doorgeeft
        ▼
GitHub Pages (deze repository)
           de pagina's die je in de browser ziet

Het rooster is een aparte tool, met een eigen spreadsheet, script en repository (rooster).
Het uitleenscherm en het bestuursscherm tonen dat rooster.
```

- **Alles is gratis**: een Google-spreadsheet met Apps Script, en GitHub Pages.
- **Alle gegevens blijven in Google.** Deze repository is publiek en bevat enkel code. Er komen hier nooit gegevens van boeken, leners of schenkers in. Ook de tests en de voorbeelden gebruiken verzonnen gegevens.
- De website vraagt de web-app enkel de publieke velden. Het script bewaart die tot 6 uur in zijn geheugen, zodat de catalogus snel laadt. Bij elke uitlening en elke wijziging in de spreadsheet ververst dat geheugen vanzelf.

## B3. Privacy en veiligheid

**Welke gegevens bewaren we?** Van een lener enkel: voornaam, eventueel achternaam, telefoon en/of e-mail, de datum van inschrijving, de toestemming en een lenersnummer. Niets meer.

**Wie ziet wat?**

| Wie | Ziet |
| --- | --- |
| Iedereen (website) | boeken en hun beschikbaarheid, nooit leners, herkomst of notities |
| Vrijwilligers (uitleenscherm) | voornaam en lenersnummer, nooit contactgegevens |
| Bestuur (bestuursscherm en spreadsheet) | ook contactgegevens, borgen en uitzonderingen |

**Hoe lang?** Elke nacht om 3 uur draait een opruiming:

- 12 maanden nadat een boek terug is, wist het script de koppeling tussen de uitlening en de lener. De uitlening blijft voor de cijfers, zonder lener.
- Een lener die op **inactief** staat, niets meer in huis heeft en 12 maanden niets leende, wordt volledig gewist.
- De termijn staat in Instellingen bij `bewaartermijn_afgesloten_uitleningen_maanden`.

Wil iemand zijn of haar gegevens laten wissen? Zet de lener op inactief in het bestuursscherm. Moet het meteen? Verwijder de rij in het tabblad Leners, nadat alle boeken terug zijn.

**De codes zijn een eenvoudige drempel, geen echte beveiliging.** Ze houden nieuwsgierigen weg, maar wie de code kent, komt binnen. Daarom:

- Geef de code van het bestuur enkel aan het bestuur.
- Wijzig een code in Instellingen als ze uitlekt, of als een vrijwilliger stopt. Op de toestellen moet je dan opnieuw aanmelden.
- Deel de spreadsheet enkel met het bestuur.

**Geen gegevens in deze repository.** Zet hier nooit exports, schermafdrukken met namen, of kopieën van de spreadsheet. Het bestand `.gitignore` houdt CSV- en Excel-bestanden al tegen.

## B4. Woordenlijst

| Woord | Betekenis |
| --- | --- |
| **Repository** | de map met alle bestanden van de website op GitHub. Deze heet `projectmadrigal.github.io`. |
| **GitHub** | de website waar de bestanden van de website staan. Wat je daar wijzigt, staat na een paar minuten online. |
| **GitHub Pages** | de gratis dienst van GitHub die de bestanden als website toont. |
| **Commit** | een wijziging op GitHub bewaren. De knop heet **Commit changes**. |
| **Apps Script** | een klein programma bij de spreadsheet. Je opent het via **Extensies > Apps Script**. |
| **Web-app** | het adres van dat programma, dat de website gebruikt om gegevens te vragen. Het eindigt op `/exec`. |
| **Implementatie, nieuwe versie** | na een wijziging in het script moet je een nieuwe versie van de web-app publiceren, anders blijft de oude draaien. |
| **Cache** | het tijdelijke geheugen van de browser of het script. Daarom zie je een wijziging soms pas na Ctrl+F5. |
| **ISBN** | het nummer van een boek, 13 cijfers. Het script zoekt daarmee covers en gegevens op. |
| **Boek-ID, exemplaarnummer** | de vaste code van een boek (B0012) en van één exemplaar (B0012-1). |

---

# Deel C. Eenmalige installatie (al gebeurd)

Dit deel heb je enkel nodig om alles opnieuw op te zetten, bijvoorbeeld in een nieuw Google-account.

## C1. De spreadsheet en het script installeren

> Werk altijd eerst op een **kopie**. Het origineel blijft intact tot alles getest is.

**De spreadsheet**

1. Open de stockspreadsheet in Google Drive, met het Google-account van Madrigal.
2. Kies **Bestand > Een kopie maken**. Noem de kopie bijvoorbeeld `Madrigal catalogus`.
3. Zet de tijdzone goed: **Bestand > Instellingen > Tijdzone**, kies `(GMT+01:00) Brussel` en klik op **Instellingen opslaan**. Anders kloppen de datums niet.
4. Deel de kopie **enkel met het bestuur**.

**Het script**

1. Open de kopie. Kies **Extensies > Apps Script**. Er opent een nieuw venster met een bestand `Code.gs`.
2. Klik links op het tandwiel **Projectinstellingen** en zet de **tijdzone** op `(GMT+01:00) Brussel`. Zie je links enkel icoontjes? Ga er met de muis over, dan verschijnen de namen.
3. Ga terug naar de **Editor** (het icoon `< >`).
4. Open op GitHub het bestand [`madrigal-script.gs`](madrigal-script.gs). Daarin staat alle code in één bestand.
   - Klik rechtsboven op het icoon **Copy raw file** (twee blaadjes over elkaar).
   - Ga terug naar Apps Script en klik in `Code.gs`.
   - Selecteer alles (Ctrl+A, op een Mac Cmd+A) en plak (Ctrl+V, op een Mac Cmd+V).
5. Klik op **Opslaan** (het diskette-icoon).
6. Ga terug naar de spreadsheet en **vernieuw** de pagina. Na een paar seconden verschijnt het menu **Madrigal**.

**Installeren**

1. Kies **Madrigal > 1. Installeer tabbladen**. Zie je het menu niet? Kies dan in Apps Script bovenaan, naast **Uitvoeren**, de functie **installeer** en klik op **Uitvoeren**.
2. De eerste keer vraagt Google om toestemming. Kies het Madrigal-account, klik op **Geavanceerd** en daarna op **Ga naar ... (onveilig)**. Dat "onveilig" betekent enkel dat Google het script niet zelf nagekeken heeft. Het is jullie eigen script.
3. De tabbladen verschijnen: Uitleningen, Reservaties, Leners, Uitzonderingen, Catalogus, Onderwerpen, Na te kijken, Nieuws, Agenda, Veelgestelde vragen, Instellingen en Logboek. Stock en Zines blijven ongemoeid.
4. Open het tabblad **Instellingen**. De codes voor de balie en het bestuur zijn willekeurig aangemaakt. Pas ze aan als je wil, en kijk de teksten na. Vul in de privacytekst het mailadres van het bestuur in.

Je mag "Installeer tabbladen" later opnieuw uitvoeren. Bestaande tabbladen, gegevens en instellingen blijven staan. Enkel wat ontbreekt, komt erbij.

## C2. De catalogus opbouwen

**De Goodreads-export (optioneel).** Goodreads heeft voor niche-titels vaak completere gegevens.

1. Meld je aan op Goodreads met het account van de shelf. Ga naar **My Books > Import and export > Export Library** en download het CSV-bestand.
2. Maak in de spreadsheet een nieuw tabblad met precies de naam **`Goodreads-export`**. Klik op cel A1, kies **Bestand > Importeren > Uploaden**, kies het bestand en kies **"Huidige blad vervangen"**.
3. Zet in Instellingen bij `goodreads_shelf` de naam van de Madrigal-shelf, precies zoals op Goodreads. Zo gebruikt het script enkel de boeken op die shelf.
4. Verwijder het tabblad `Goodreads-export` nadat je stap 2 hieronder uitvoerde: het bevat ook de rest van je persoonlijke bibliotheek. Bewaar het CSV-bestand nooit in deze repository.

**De stappen in het menu Madrigal**, in deze volgorde. Elke stap mag je opnieuw uitvoeren: er komt niets dubbel, en wat je met de hand verbeterde, blijft staan.

1. **2. Bouw de catalogus uit Stock en Zines.** Leest Stock en Zines en schrijft één nette lijst naar de Catalogus. Maakt ISBN's netjes (een ongeldig ISBN komt in `isbn_origineel`), geeft elk boek een vaste boek-ID, zet de herkomst in een aparte kolom die nooit publiek wordt, en vult de vertaaltabel Onderwerpen. Staat er "niet op site" in de herkomst, dan krijgt het boek `publiek = nee`. Zines met genre "verkoop" krijgen `uitleenbaar = nee`.
2. **3. Vul aan uit Goodreads.** Vult enkel lege velden aan: uitgeverij, jaartal en pagina's. De stocklijst wint altijd. Twijfelgevallen gaan naar **Na te kijken**.
3. **4. Vul aan uit Open Library.** Zoekt voor boeken met een ISBN wat nog ontbreekt, en een cover. Dit werkt in porties van een paar minuten en gaat vanzelf verder. Daarna starten vanzelf:
   - **5. Zoek ontbrekende covers bij Google Books**;
   - **6. Zoek ontbrekende beschrijvingen** (Google Books, dan Open Library);
   - **7. Vertaal de beschrijvingen** naar het Nederlands en het Engels, gratis met Google Translate. Het blijft een automatische vertaling: lees de beschrijvingen van aanraders even na.

   Zonder sleutel geeft Google een beperkt aantal opvragingen per dag. Is die limiet bereikt, dan gaat het script 6 uur later vanzelf verder. Sneller? Maak een gratis sleutel voor de Google Books-API in de Google Cloud Console en zet ze in Instellingen bij `google_books_api_key`.
4. **Het tabblad Na te kijken.** Klopt de waarde uit de bron (`waarde_bron`)? Zet ze zelf in de Catalogus. Zet daarna **ja** in de kolom `afgehandeld`.

De Catalogus is nu de enige bron. Stock en Zines heb je niet meer nodig.

## C3. De vertaaltabel Onderwerpen nakijken

De filters op de website gebruiken **filtergroepen**: Gender, Seksualiteit, Feminisme, Fictie, Klassiekers, Geschiedenis en maatschappij, Biografie, Poëzie, Graphic novel, Young adult, Pulp, Erotica en BDSM, Zines.

Het tabblad **Onderwerpen** vertaalt elk genre uit de stocklijst naar een of meer filtergroepen:

| genre | filtergroepen | aantal_boeken |
| --- | --- | --- |
| Young adult | Young adult | 34 |
| erotica | Erotica en BDSM | 12 |
| roman lesbisch | Fictie, Seksualiteit | 51 |

- Het script stelt zelf een filtergroep voor. **Kijk elke rij na** en pas aan waar nodig. Meerdere groepen scheid je met een komma.
- "Klassiekers" bestaat niet als genre: zet in de Catalogus **ja** in de kolom `klassieker`.
- Een nieuwe filtergroep maken? Typ een nieuwe naam in de kolom `filtergroepen`. Ze verschijnt vanzelf op de website.
- Komen er nieuwe genres bij? Kies **Madrigal > Werk de vertaaltabel Onderwerpen bij**.

## C4. Lopende uitleningen overnemen uit het oude uitleenblad

Neem **enkel de lopende uitleningen** over. De historiek blijft in het oude blad.

1. Kies een vaste datum waarop het papieren en het oude digitale uitleenblad stoppen. Spreek die af met het bestuur en de vrijwilligers.
2. Zorg dat het oude blad bijgewerkt is: elk teruggebracht boek heeft een datum in "boek terug op...".
3. Kies **Madrigal > Neem lopende uitleningen over uit het oude blad**, plak de link naar het oude uitleenblad en klik op **OK**.
4. Het script neemt enkel rijen zonder terugbrengdatum over, zoekt het boek op titel en auteur, maakt per persoon één lener aan, en neemt de borg, de betaalwijze, de terugbrengdatum en de laatste herinnering mee.
5. Kijk **Na te kijken** na (bron "Overzetten") en registreer die uitleningen zelf via het uitleenscherm.
6. Overgenomen leners hebben `toestemming_privacy = onbekend`. Vraag hun toestemming bij het volgende bezoek en zet dan **ja** in het tabblad Leners.
7. Zet het oude blad op "alleen lezen" en verwijder het na de bewaartermijn.

## C5. Het script publiceren als web-app

1. Open in de spreadsheet **Extensies > Apps Script**.
2. Klik rechtsboven op **Implementeren > Nieuwe implementatie**.
3. Klik op het tandwiel naast "Type selecteren" en kies **Web-app**.
4. Vul in: beschrijving `Catalogus Madrigal`, uitvoeren als **Ik**, toegang **Iedereen**.
5. Klik op **Implementeren** en geef toestemming als Google erom vraagt.
6. Kopieer de **URL van de web-app**. Ze eindigt op `/exec`.
7. Open op GitHub het bestand [`config.js`](config.js), klik op het potlood (**Edit**), en plak de URL tussen de aanhalingstekens achter `apiUrl:`.
8. Klik op **Commit changes**. Na een paar minuten toont de website de echte catalogus.

"Iedereen" betekent: iedereen kan het **publieke** deel opvragen. De rest vraagt een code (zie [B3](#b3-privacy-en-veiligheid)).

## C6. De website online zetten met GitHub Pages

1. Ga op GitHub naar de repository **projectmadrigal.github.io** van de organisatie ProjectMadrigal.
2. Klik op **Settings > Pages**.
3. Kies bij "Build and deployment" **Deploy from a branch**, branch **main**, map **/ (root)**. Klik op **Save**.
4. Na een paar minuten staat de website online op https://projectmadrigal.github.io/.

Waarom die naam? Een repository die precies `<naam van de organisatie>.github.io` heet, krijgt het korte adres. Een andere repository van dezelfde organisatie, zoals **rooster**, komt op `https://projectmadrigal.github.io/rooster/`. Hernoem de repository dus niet, anders verandert het adres.

**Op het beginscherm zetten.** Open de website op een smartphone en kies in het menu van de browser **Toevoegen aan beginscherm**. Doe dat op de smartphone van de balie voor het uitleenscherm.

## C7. Nieuws, agenda en vragen overnemen van de oude website

Kies **Madrigal > Neem nieuws, agenda en vragen over van de oude website**. Het script haalt alles op en zet het in de tabbladen Nieuws, Agenda en Veelgestelde vragen. Opnieuw uitvoeren maakt niets dubbel.

- Kijk de teksten daarna na: opmaak zoals vet en links verdwijnt.
- De afbeeldingen blijven op de server van de oude website staan. Zet ze op een andere plaats voor je die server opzegt, en pas de link in de kolom `afbeelding` aan.

## C8. Het rooster koppelen

Het rooster is een aparte tool (repository **rooster**, met een eigen handleiding). Om het rooster te tonen in het uitleenscherm en het bestuursscherm, vul je in de Instellingen van de catalogus, onder `── ROOSTER ──`, in:

| Instelling | Wat |
| --- | --- |
| `rooster_url` | de URL van de web-app van het rooster. Je vindt ze in de roosterspreadsheet via Extensies > Apps Script > Implementeren > Implementaties beheren. Ze eindigt op `/exec`. |
| `rooster_code` | de toegangscode voor vrijwilligers van het rooster (`toegangscode_vrijwilligers` in de Instellingen van de roosterspreadsheet). Niet de code van de planner. |
| `rooster_link` | het adres van de roostertool, standaard `https://projectmadrigal.github.io/rooster/` |

De code blijft op de server van Google: de browser ziet ze nooit. Verander je de code in het rooster, pas ze dan ook hier aan. Een wijziging in het rooster verschijnt na hoogstens 10 minuten in de balie en het bestuur.

## C9. Het eigen domein projectmadrigal.be

Wil je dat projectmadrigal.be naar deze website wijst:

1. Ga op GitHub naar **Settings > Pages > Custom domain**, vul `www.projectmadrigal.be` in en klik op **Save**.
2. Pas bij je domeinregistrar de DNS aan: een `CNAME`-record voor `www` naar `projectmadrigal.github.io`, en voor het domein zonder www de vier `A`-records van GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` en `185.199.111.153`.
3. Vink **Enforce HTTPS** aan zodra GitHub dat toelaat. Dat duurt soms een dag.

Doe dit pas als de oude website weg mag: vanaf dat moment toont projectmadrigal.be de nieuwe website. Oude links zoals `/boeken` sturen vanzelf door naar de juiste pagina.

---

# Deel D. Voor een beheerder

## D1. Een nieuwe versie van het script publiceren

Verandert er iets in de code van Apps Script, dan ziet de web-app dat pas na een nieuwe versie.

1. Open op GitHub [`madrigal-script.gs`](madrigal-script.gs), kopieer alles (**Copy raw file**), vervang alles in `Code.gs` en klik op **Opslaan**.
2. Kies in de spreadsheet **Madrigal > 1. Installeer tabbladen**. Zo komen nieuwe kolommen en instellingen erbij. Wat er al staat, blijft.
3. Klik in Apps Script op **Implementeren > Implementaties beheren**.
4. Klik op het **potlood** bij je web-app.
5. Kies bij Versie: **Nieuwe versie**. Klik op **Implementeren**.

De URL blijft dezelfde. Je hoeft `config.js` niet aan te passen. Vraagt Google opnieuw toestemming, klik dan op **Toestaan**.

Een wijziging in de **spreadsheet** (een boek, een instelling, een tekst) vraagt geen nieuwe versie. Die is meteen actief.

## D2. Orde in de spreadsheet

De tabbladen staan in een vaste volgorde met een kleur per groep (zie [A1](#a1-waar-staat-wat)). De instellingen staan per thema onder een tussenkop, bijvoorbeeld `── UITLENEN ──`. Een Engelse tekst staat vlak onder de Nederlandse. De tussenkoppen zijn geen instellingen.

"Installeer tabbladen" ordent alles opnieuw. Wil je enkel ordenen, kies dan **Madrigal > Orden tabbladen en instellingen**. Waarden die je invulde, blijven altijd staan. Een instelling die je zelf toevoegde, komt onder `── OVERIGE ──`.

## D3. De website zelf aanpassen

**Een klein ding wijzigen, zonder iets te installeren:**

1. Open het bestand op GitHub, bijvoorbeeld [`i18n.js`](i18n.js).
2. Klik rechtsboven op het **potlood** (Edit this file).
3. Pas de tekst aan. Laat aanhalingstekens, komma's en haakjes staan.
4. Klik op **Commit changes** en bevestig.
5. Na een paar minuten staat de wijziging online. Vernieuw met **Ctrl+F5**.

GitHub controleert elke wijziging automatisch (het tabblad **Actions**). Een rood kruisje betekent dat er iets misging: draai de wijziging terug of vraag hulp.

| Wat | Bestand |
| --- | --- |
| Vaste teksten en knoppen (Nederlands en Engels) | [`i18n.js`](i18n.js) |
| Tekst, team en foto's op Over ons | [`over-ons.html`](over-ons.html), foto's in `assets/team/` |
| Kleuren | [`styles.css`](styles.css), bovenaan bij de regels die met `--kleur-` beginnen |
| Menu, Instagram en de voet onderaan | [`layout.js`](layout.js) |
| De grenzen aan de balie | [`apps-script/Grenzen.js`](apps-script/Grenzen.js), met uitleg bovenaan. Daarna `madrigal-script.gs` opnieuw maken (zie hieronder) en [D1](#d1-een-nieuwe-versie-van-het-script-publiceren). |

**Met hulp van Claude.** In deze repository staat [`CLAUDE.md`](CLAUDE.md): een samenvatting die Claude bij een nieuwe sessie automatisch leest. Begin per opdracht een nieuwe sessie en beschrijf alles wat je wil in één bericht.

**Voor wie de code aanpast.** Installeer [Node.js](https://nodejs.org) en voer in deze map uit:

```
node tools/bundel.js
node tests/run.js
```

`tools/bundel.js` maakt `madrigal-script.gs` opnieuw uit de map `apps-script/`. Pas `madrigal-script.gs` nooit met de hand aan. Alle tests moeten "ok" tonen.

## D4. Waar alles staat

**In Google (het account van Madrigal)**

- De spreadsheet `Madrigal catalogus`: alle gegevens.
- Het Apps Script-project, via Extensies > Apps Script in die spreadsheet.
- De web-app: Implementeren > Implementaties beheren.
- Geplande taken (Apps Script > Triggers, het wekkertje): `ruimOp` elke nacht, `bijWijziging` bij elke wijziging, en tijdelijke taken die het opzoeken van boekgegevens vanzelf laten verdergaan.
- De roosterspreadsheet, met een eigen Apps Script-project.

**In deze repository**

| Bestand | Wat erin staat |
| --- | --- |
| `index.html`, `home.js` | de startpagina |
| `boeken.html`, `app.js` | de publieke catalogus |
| `over-ons.html` | de pagina Over ons |
| `layout.js` | de kop (menu, taal, donkere modus) en de voet van elke publieke pagina |
| `i18n.js` | alle vaste teksten in het Nederlands en het Engels |
| `404.html` | stuurt adressen van de oude website door (bv. `/boeken`) |
| `assets/` | logo, lettertype (Geist Mono) en foto's |
| `zoeken.js` | zoeken met tikfouten, zonder hoofdletters, accenten en lidwoorden |
| `filters.js` | de filters en het sorteren |
| `balie.html`, `balie.js` | het uitleenscherm |
| `bestuur.html`, `bestuur.js` | het bestuursscherm |
| `beheer.js` | gedeeld door balie en bestuur: aanmelden, statuslabels, het rooster |
| `api.js` | praat met de web-app |
| `dom.js` | kleine hulpfuncties om pagina's te bouwen, en de tijdelijke covers |
| `config.js` | de URL van de web-app |
| `styles.css` | kleuren, lettertypes en opmaak |
| `manifest.json`, `icons/`, `favicon.ico` | om de site op het beginscherm te zetten |
| `handleiding-balie.html` | handleiding van één pagina om af te drukken |
| `voorbeeld/` | verzonnen voorbeeldboeken en -nieuws, voor als de web-app nog niet gekoppeld is |
| `apps-script/` | alle code van Google Apps Script, per onderwerp |
| `madrigal-script.gs` | dezelfde code in één bestand, om in Apps Script te plakken |
| `tools/bundel.js` | maakt `madrigal-script.gs` opnieuw |
| `tests/` | tests met verzonnen gegevens |
| `CLAUDE.md` | samenvatting voor Claude |

**De Apps Script-bestanden**

| Bestand | Wat erin staat |
| --- | --- |
| `Menu.js` | het menu Madrigal en de installatie |
| `Instellingen.js` | standaardwaarden en uitleg van de instellingen |
| `Ordenen.js` | de volgorde van de tabbladen en de thema's in Instellingen |
| `Catalogus.js` | opbouw van de Catalogus, nieuwe boeken en de vertaaltabel Onderwerpen |
| `Goodreads.js`, `OpenLibrary.js`, `GoogleBooks.js` | gegevens en covers aanvullen |
| `Beschrijvingen.js` | beschrijvingen zoeken en vertalen |
| `Grenzen.js` | **de grenzen** aan de balie, met uitleg om er een toe te voegen |
| `Uitlenen.js` | uitlenen, terugbrengen, verlengen, reserveren, leners |
| `Datums.js` | terugbrengdatums, openingsdagen en statusteksten |
| `Publiek.js` | welke velden van een boek publiek zijn |
| `Site.js` | de inhoud van de startpagina |
| `Bestuur.js` | gegevens voor het uitleenscherm en het bestuursscherm |
| `Rooster.js` | het vrijwilligersrooster ophalen |
| `Privacy.js` | de nachtelijke opruiming |
| `Overzetten.js` | eenmalig: lopende uitleningen uit het oude blad |
| `OudeSite.js` | eenmalig: nieuws, agenda en vragen van de oude website |
| `Api.js` | de web-app: het publieke en de afgeschermde eindpunten |
| `Opslag.js` | lezen en schrijven van de tabbladen |
| `Hulp.js` | hulpfuncties voor tekst, ISBN en datums |
