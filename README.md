# DailyFit — echte applicatie

**Huidige versie: 1.4.1** (zie ook `version` in `package.json` — deze twee horen altijd gelijk te zijn).

Dit is de echte, werkende opvolger van de klikbare demo: een Node.js-webapplicatie met een PostgreSQL-database, gebouwd volgens `technisch-ontwerp.md` in het DailyFit-project. Alles hieronder is getest en werkt lokaal; wat nog moet gebeuren staat onderaan.

## Wijzigingen (changelog)
Bij elke wijziging aan de code wordt hier een nieuwe regel toegevoegd én het versienummer hierboven (en in `package.json`) opgehoogd. Zo is in één oogopslag te zien welke versie waar draait (test vs. live) en wat er precies is veranderd — dat voorkomt dat een fout ergens onopgemerkt blijft hangen.

- **1.4.1** (3 sep 2026) — Echte bugfix voor de schermvullende video op de iPhone: in versie 1.4.0 werd de "hele scherm vullen"-instructie stil overschreven door een andere, oudere stijl-instructie op hetzelfde onderdeel, waardoor het op de iPhone (getest via een echte oefenversie-video) niet werkte — de video werd wel heel hoog, maar bleef los tussen de rest van de pagina staan in plaats van het scherm echt te bedekken. Dat conflict is nu weggehaald en opnieuw getest.
- **1.4.0** (3 sep 2026) — Twee verbeteringen naar aanleiding van getest gebruik: (1) de video vult nu écht het hele scherm op alle toestellen, ook op de iPhone — eerder werkte dit alleen op de computer, omdat Safari op iPhone de browser-eigen "volledig scherm"-functie niet toestaat voor een ingesloten video; er is nu een eigen schermvullende weergave gebouwd die daar niet van afhankelijk is. (2) De 7 dag-bolletjes staan nu altijd in een vaste volgorde maandag t/m zondag (M D W D V Z Z) in plaats van steeds de laatste 7 dagen terug te rekenen vanaf vandaag.
- **1.3.1** (3 sep 2026) — Het versienummer staat nu ook onderaan in de app zelf (bijv. "DailyFit — werkende versie · v1.3.1"), zodat direct te zien is welke versie er open staat, zonder in de bestanden te hoeven kijken.
- **1.3.0** (3 sep 2026) — De video speelt nu op het hele scherm af: op de video-pagina verschijnt een grote "Start de video"-knop, die zowel het afspelen start als het scherm vult; zodra de video is afgelopen (of via de noodknop) gaat het scherm vanzelf weer terug naar de normale weergave. Ook is de video-pagina steviger gemaakt: als de koppeling met Cloudflare's speler om wat voor reden dan ook niet laadt, blijft de noodknop na de bekende videolengte gewoon verschijnen (voorheen kon de pagina in dat geval vastlopen).
- **1.2.0** (3 sep 2026) — Teksten aangepast naar meervoud ("Rugoefeningen" i.p.v. "Rugoefening", "Start de oefeningen", enz.); de 7 voortgangsbolletjes op het senior-scherm tonen nu de eerste letter van de dag (M/D/W/D/V/Z/Z) in plaats van lege bolletjes.
- **1.1.0** (3 sep 2026) — Nieuw logo (het "D"-icoon) doorgevoerd; naam overal gewijzigd van "Daily Fit" naar "DailyFit" (aan elkaar), in de app én in alle bestandsnamen/teksten.
- **1.0.3** (± sep 2026) — Eerste poging om te zorgen dat een video maar 1x per dag afgespeeld kan worden: koppeling met de Cloudflare-videospeler zelf (detecteert het einde van de video), met een extra vangnet-knop als dat niet lukt. Bevestigd door de gebruiker dat dit nog niet volledig werkt — dit staat open.
- **1.0.2** — Video's die vastliepen op de status "Wordt verwerkt" worden nu automatisch ververst zodra het planningsscherm wordt geopend, in plaats van daar handmatig op te moeten wachten.
- **1.0.1** — Fix voor "Internal Server Error" bij het inloggen op Railway (de interne verbinding met de database had geen SSL nodig, maar de app vroeg dat toch af).
- **1.0.0** — Eerste werkende versie: inloggen (senior + beheerder), planningscherm, gebruikersbeheer, koppeling met Cloudflare Stream voor video-upload en beveiligd afspelen.

## Wat er nu al werkt
- Inloggen: senior met gebruikersnaam + mobiel nummer (spaties/streepjes worden genegeerd), beheerder met gebruikersnaam + wachtwoord (veilig gehasht, nooit in platte tekst opgeslagen).
- Langlopende sessie na het inloggen (geen dagelijkse herinlog), met een aparte sessietabel zodat een sessie ook weer ingetrokken kan worden.
- Bescherming tegen het "raden" van inloggegevens: na 5 mislukte pogingen wordt een account 5 minuten vergrendeld.
- De dagelijkse limiet ("1x per dag, pas geteld als uitgekeken") wordt nu echt door de server afgedwongen — rechtstreeks naar de video-pagina surfen helpt niet meer als de oefening al gedaan is.
- Verlopen abonnementen: een senior zonder geldige betaaldatum ziet automatisch het "verlopen"-scherm in plaats van de dagelijkse oefening, ook als hij de video-pagina rechtstreeks probeert te openen.
- Beheerscherm: planning voor 14 dagen vooruit, gebruikersbeheer (aanmaken, naam/telefoonnummer/betaaldatum bijwerken), met dezelfde regels als de demo (senior heeft een telefoonnummer nodig, beheerder een wachtwoord).
- Cloudflare Stream-koppeling: het planningsscherm kan een video rechtstreeks vanaf de computer van de beheerder naar Cloudflare uploaden (zonder om te weg via onze eigen server) en koppelt 'm daarna aan de gekozen dag. Zolang er geen Cloudflare-gegevens zijn ingevuld, staat deze knop uit en toont het scherm daar een duidelijke melding over.

## Vereisten
- Node.js 18 of hoger.
- Een PostgreSQL-database (lokaal om te testen; op Railway wordt dit straks automatisch geregeld).

## Lokaal opzetten en uitproberen
```
npm install
cp .env.example .env        # vul daarna in elk geval ADMIN_PASSWORD in
npm start
```
De tabellen worden bij het opstarten automatisch aangemaakt, en het beheerder-account wordt automatisch aangemaakt/bijgewerkt op basis van `ADMIN_USERNAME`/`ADMIN_PASSWORD` — geen apart commando nodig. De website draait dan op `http://localhost:3000`. Log in met die gebruikersnaam/wachtwoord. Nieuwe (senior-)accounts maak je daarna aan via het scherm "Gebruikers" in het beheerpaneel.

(`npm run migrate` en `npm run seed-admin` bestaan nog als losse commando's voor gevorderd gebruik, maar zijn niet meer nodig voor de normale gang van zaken.)

`browser-test.mjs` is een geautomatiseerde controle van de belangrijkste flows (inloggen, daglimiet, verlopen abonnement, gebruikersbeheer, vergrendeling na mislukte pogingen) — handig om na een wijziging snel te checken of alles nog werkt.

## Cloudflare Stream instellen
In je Cloudflare-dashboard, onder "Stream":
1. **Account ID**: staat rechtsonder op de meeste Cloudflare-dashboardpagina's, of onder Overzicht van je account.
2. **API-token**: aanmaken via "Manage API Tokens" met rechten voor Stream (lezen én schrijven).
3. **Customer code**: open een willekeurige video in je Stream-dashboard en bekijk de voorbeeld-embedcode; daarin staat een adres als `customer-abc123xyz.cloudflarestream.com` — alleen het stuk `abc123xyz` gaat in `CLOUDFLARE_STREAM_CUSTOMER_CODE`.

Zet deze drie waarden in `.env` (lokaal) of als omgevingsvariabelen op Railway (productie), en herstart de applicatie. Zodra ze ingevuld zijn, verschijnt de upload-knop in het planningsscherm en werkt het echte afspelen (met een kortlevende, beveiligde link per video, zodat een gedeelde link buiten de app niet blijft werken).

## Deployen naar Railway
1. Maak in Railway een nieuw project.
2. Voeg een **Postgres**-service toe aan dat project (Railway zet `DATABASE_URL` dan automatisch klaar voor de andere service in hetzelfde project).
3. Voeg een tweede service toe voor deze applicatie (bijvoorbeeld door deze code naar een GitHub-repository te pushen en die aan Railway te koppelen).
4. Zet op die webservice de omgevingsvariabelen: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME`, en `NODE_ENV=production`.
5. Niets meer te draaien — de tabellen en het beheerder-account worden automatisch klaargezet zodra de applicatie voor het eerst opstart.
6. Koppel het domein mijndailyfit.nl aan deze Railway-service (Railway geeft de precieze DNS-instructie).

Een eenvoudigere, stap-voor-stap versie van dit hoofdstuk (zonder terminal-commando's, met screenshots-in-woorden) staat in het DailyFit-project als `railway-en-cloudflare-simpel.md`.

## Wat nog moet gebeuren
- De video mag nu nog vaker dan 1x per dag bekeken worden in sommige gevallen — de koppeling met de Cloudflare-speler werkt nog niet volledig betrouwbaar. Dit staat open om verder uit te zoeken.
- De video-upload en het afspelen zijn geschreven volgens Cloudflare's documentatie, maar nog niet uitgebreid getest met echte (lange) video's in de praktijk. Eerste keer uitproberen met een echte video verdient extra aandacht.
- Er is geen automatische e-mail/sms-melding als een video nog "wordt verwerkt" blijft hangen — de beheerder ziet dat nu alleen visueel in het planningsscherm.
- Wachtwoord/telefoonnummer kwijt: de beheerder corrigeert dit nu via het scherm "Gebruikers" (geen aparte "wachtwoord vergeten"-flow nodig, zoals afgesproken).
- Een redirect van het kale domein `mijndailyfit.nl` naar `www.mijndailyfit.nl` staat nog niet ingesteld (optioneel, kan later).

## Werkwijze: testen vóór live
Nieuwe wijzigingen gaan altijd eerst naar de `test`-branch op GitHub, worden gecontroleerd op de aparte testomgeving (oefenversie) op Railway, en pas daarna via een pull request naar `main` (de live omgeving) gebracht. Zie `oefenversie-en-live-versie.md` in het DailyFit-project voor de volledige stappen.
