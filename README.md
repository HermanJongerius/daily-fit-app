# DailyFit — echte applicatie (eerste versie)

Dit is de echte, werkende opvolger van de klikbare demo: een Node.js-webapplicatie met een PostgreSQL-database, gebouwd volgens `technisch-ontwerp.md` in het DailyFit-project. Alles hieronder is getest en werkt lokaal; wat nog moet gebeuren staat onderaan.

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
- Dit is nog niet naar Railway gedeployed — dat is de volgende stap zodra je zover bent.
- De video-upload en het afspelen zijn geschreven volgens Cloudflare's documentatie, maar nog niet getest met een echt Cloudflare-account (daar was in deze sessie geen toegang toe). Eerste keer uitproberen met een echte video verdient extra aandacht.
- Er is geen automatische e-mail/sms-melding als een video nog "wordt verwerkt" blijft hangen — de beheerder ziet dat nu alleen visueel in het planningsscherm.
- Wachtwoord/telefoonnummer kwijt: de beheerder corrigeert dit nu via het scherm "Gebruikers" (geen aparte "wachtwoord vergeten"-flow nodig, zoals afgesproken).
