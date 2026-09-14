import { writeFileSync } from 'node:fs';
import pkg from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import { JOINTS_BY_WEEKDAY, weekdayInAppTz, todayIso, isoDateLocal } from './src/helpers.js';
import * as views from './src/views.js';
import { pool } from './src/db.js';

const expectedJointToday = JOINTS_BY_WEEKDAY[weekdayInAppTz()];

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('OK:', msg);
}

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

// --- schedule voor vandaag klaarzetten: 4 klaarstaande video-slots. Sinds versie 1.11.0
// staan er per dag 4 video's gepland i.p.v. 1 (zie schema.sql), en deze testreeks moet daar
// niet stilzwijgend van afhankelijk zijn van eerder handmatig ingevoerde (en inmiddels
// verouderde) planningsdata — dus hier expliciet zelf klaarzetten, ongeacht wat er al stond.
{
  const today = todayIso();
  for (let slot = 1; slot <= 4; slot++) {
    await pool.query(
      `INSERT INTO schedule (date, slot, joint, video_status)
       VALUES ($1, $2, $3, 'ready')
       ON CONFLICT (date, slot) DO UPDATE SET joint = $3, video_status = 'ready'`,
      [today, slot, expectedJointToday]
    );
  }
}

// --- niet ingelogd -> /login ---
await page.goto(BASE + '/');
await page.waitForSelector('form[action="/login"]');
assert(true, 'niet-ingelogde bezoeker ziet het loginformulier');

// --- fout wachtwoord/nummer voor senior ---
await page.fill('input[name="username"]', 'corrie');
await page.fill('input[name="credential"]', '0699999999');
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');
let text = await page.textContent('body');
assert(text.includes('klopt niet'), 'verkeerd nummer geeft een foutmelding');

// --- juiste login senior, met spaties in het nummer ---
await page.fill('input[name="username"]', 'corrie');
await page.fill('input[name="credential"]', '06 12 34 56 78');
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(page.url().endsWith('/vandaag'), 'senior komt na login op /vandaag terecht');
assert(text.toLowerCase().includes(expectedJointToday.toLowerCase()), `de oefening van vandaag (${expectedJointToday}) wordt getoond`);

// --- naar de oefeningen: sinds versie 1.11.0 staan er per dag 4 video's (een gewricht moet
// vanuit meerdere kanten bewogen worden), die de deelnemer één voor één afvinkt — in
// dev-modus via de "markeer als uitgekeken"-knop. Na elke video (behalve de laatste) gaat
// de browser terug naar /video zelf, dat dan vanzelf de eerstvolgende, nog niet afgevinkte
// video toont áchter het "Start de video"-scherm — dat opnieuw aantikken is de "zelf klikken
// tussen de video's"-stap. Pas na de 4e video telt de hele dag als afgerond.
await page.click('a[href="/video"]');
await page.waitForLoadState('networkidle');
for (let i = 1; i <= 4; i++) {
  text = await page.textContent('body');
  assert(text.includes('Ontwikkelmodus'), `video ${i} van 4: zonder Cloudflare-configuratie verschijnt de ontwikkelmodus-notitie`);
  assert(text.includes(`Oefening ${i} van 4`), `video ${i} van 4: de voortgangsbalk toont "Oefening ${i} van 4"`);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  if (i < 4) {
    assert(page.url().endsWith('/video'), `na video ${i} van 4 gaat het terug naar /video, klaar voor de volgende (nog geen /voortgang)`);
  } else {
    assert(page.url().endsWith('/voortgang'), 'na de 4e en laatste video van de dag verschijnt pas het voortgangsscherm (cyclus-onthulling)');
  }
}
text = await page.textContent('body');
assert(text.includes('vakje') || text.includes('Compleet') || text.includes('Trots op je') || text.includes('Lekker bezig'), 'voortgangsscherm toont de cyclus-onthulling of een van de eindteksten');
const hasAutoRefresh = await page.locator('meta[http-equiv="refresh" i]').count();
assert(hasAutoRefresh === 0, 'het voortgangsscherm schakelt niet meer automatisch door — alleen via de "Verder"-knop');
await page.click('a:has-text("Verder")');
await page.waitForLoadState('networkidle');
assert(page.url().endsWith('/vandaag'), 'de "Verder"-knop op het voortgangsscherm gaat naar /vandaag');
text = await page.textContent('body');
assert(text.includes('Tot morgen'), 'na het voortgangsscherm toont /vandaag de "al bewogen"-status');

// --- serverkant afgedwongen daglimiet: rechtstreeks naar /video mag niet nog een keer tellen ---
await page.goto(BASE + '/video');
assert(page.url().endsWith('/vandaag'), 'direct naar /video na voltooiing stuurt terug naar /vandaag (server-side afgedwongen)');

// --- uitloggen, inloggen als de verlopen senior ---
await page.click('button:has-text("Uitloggen")');
await page.waitForLoadState('networkidle');
await page.fill('input[name="username"]', 'verlopen');
await page.fill('input[name="credential"]', '0687654321');
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(text.includes('Je toegang is verlopen'), 'verlopen senior ziet het verlopen-scherm i.p.v. de dagelijkse flow');

// --- rechtstreeks naar /video als verlopen senior mag niet werken ---
await page.goto(BASE + '/video');
text = await page.textContent('body');
assert(text.includes('Je toegang is verlopen') || page.url().endsWith('/vandaag'), 'verlopen senior kan niet via de URL alsnog bij de video komen');

// --- uitloggen, inloggen als beheerder ---
await page.click('button:has-text("Uitloggen")');
await page.waitForLoadState('networkidle');
await page.fill('input[name="username"]', 'beheerder');
await page.fill('input[name="credential"]', 'test-admin-123');
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(page.url().endsWith('/admin/planning'), 'beheerder komt op /admin/planning terecht');
assert(text.includes('Planning'), 'planningscherm wordt getoond');
assert(text.includes('Cloudflare Stream is nog niet ingesteld'), 'melding dat Cloudflare nog niet is ingesteld, dus upload staat uit');

// --- beheerder: nieuw scherm voor de informatie-video's (los van de dagelijkse planning) ---
await page.click('a[href="/admin/videos"]');
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(text.includes("Informatie-video's"), "het nieuwe beheerscherm voor informatie-video's wordt getoond");
assert(text.includes('Nog geen video'), 'zolang er nog geen video is toegevoegd, toont het scherm dat duidelijk');

// --- gebruikers-scherm: nieuw account aanmaken ---
await page.click('a[href="/admin/gebruikers"]');
await page.waitForLoadState('networkidle');
await page.fill('form[action="/admin/gebruikers"] input[name="displayName"]', 'Test Persoon');
await page.fill('form[action="/admin/gebruikers"] input[name="username"]', 'testp');
await page.fill('form[action="/admin/gebruikers"] input[name="phone"]', '0611122233');
await page.click('form[action="/admin/gebruikers"] button[type="submit"]');
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(text.includes('Test Persoon'), 'nieuw aangemaakte senior verschijnt in de lijst');
assert(text.includes('0611122233'), 'telefoonnummer van de nieuwe gebruiker wordt getoond');

// --- exporteren naar Excel: naam, telefoonnummer en trainingsvoortgang van alle deelnemers ---
{
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a[href="/admin/gebruikers/export"]'),
  ]);
  const exportPath = '/tmp/_browsertest_export.xlsx';
  await download.saveAs(exportPath);
  assert(/^dailyfit-deelnemers-\d{4}-\d{2}-\d{2}\.xlsx$/.test(download.suggestedFilename()), 'de Excel-export krijgt een herkenbare bestandsnaam met datum');

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(exportPath);
  const sheet = workbook.getWorksheet('Deelnemers');
  const headerRow = sheet.getRow(1).values.slice(1);
  assert(
    headerRow.join('|') === ['Naam', 'Groep', 'Mobiel nummer', 'Betaald tot', 'Status', 'Toegang', 'Reden van stoppen', 'Aangemeld op', 'Aantal keer getraind', 'Mogelijke traindagen', 'Percentage getraind'].join('|'),
    'de Excel-export heeft de verwachte kolomkoppen'
  );
  const rows = [];
  sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(row.values.slice(1)); });
  const testRow = rows.find((r) => r[0] === 'Test Persoon');
  assert(!!testRow, 'de nieuw aangemaakte senior staat ook in de Excel-export');
  assert(testRow[1] === 'Geen groep', 'een nieuwe deelnemer staat in de export met groep "Geen groep" (nog niet ingevuld)');
  assert(testRow[2] === '0611122233', 'het telefoonnummer in de export klopt');
  assert(testRow[5] === 'Actief' && testRow[6] === 'Nog actief', 'een nieuwe deelnemer staat in de export met toegang "Actief" en reden "Nog actief"');
  assert(!rows.some((r) => r[0] === 'Beheerder'), 'het beheerder-account zelf staat niet tussen de deelnemers in de export');
}

// --- dubbele gebruikersnaam wordt geweigerd ---
await page.fill('form[action="/admin/gebruikers"] input[name="displayName"]', 'Dup');
await page.fill('form[action="/admin/gebruikers"] input[name="username"]', 'testp');
await page.fill('form[action="/admin/gebruikers"] input[name="phone"]', '0699988877');
await page.click('form[action="/admin/gebruikers"] button[type="submit"]');
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(text.includes('bestaat al'), 'dubbele gebruikersnaam geeft een foutmelding');

// --- pasfoto uploaden voor een deelnemer (nieuw, versie 1.12.0): alleen zichtbaar in het
// beheerdersoverzicht, geen foto-veld bij het aanmaken van een nieuw account (dat kan alleen
// achteraf via dit bewerkformulier) ---
// Let op: alle klikken op de "Opslaan"-knop hieronder gebruiken bewust page.click() met een
// scoped selector (dus geen ruwe el.click() via $eval) — dat laat Playwright de navigatie na
// de POST correct volgen, wat betrouwbaarder samenwerkt met de daaropvolgende waitForLoadState.
{
  const testpFormSel = 'form[action="/admin/gebruikers/testp"]';
  // Zorgt dat deze test ook bij een herhaalde run (testp bestaat dan al van een vorige keer)
  // start vanuit dezelfde schone toestand: nog geen foto.
  await pool.query("UPDATE users SET photo = NULL, photo_mime = NULL, photo_updated_at = NULL WHERE username = 'testp'");
  await page.reload();
  await page.waitForLoadState('networkidle');

  assert((await page.locator(`${testpFormSel} >> xpath=.. >> img`).count()) === 0, 'zolang er nog geen foto is geüpload, staat er geen <img>-tag (alleen het initiaal-plaatje)');

  // --- verkeerd bestandstype wordt geweigerd, met een duidelijke melding ---
  await page.locator(`${testpFormSel} input[type="file"]`).setInputFiles({
    name: 'niet-een-foto.txt', mimeType: 'text/plain', buffer: Buffer.from('dit is geen foto'),
  });
  await page.click(`${testpFormSel} button[type="submit"]`);
  await page.waitForLoadState('networkidle');
  text = await page.textContent('body');
  assert(text.includes('Alleen JPEG, PNG of WEBP'), 'een verkeerd bestandstype als foto wordt geweigerd met een duidelijke melding');
  assert((await page.locator(`${testpFormSel} >> xpath=.. >> img`).count()) === 0, 'na een geweigerde upload staat er nog steeds geen foto');

  // --- een geldige (heel kleine) afbeelding wordt wél geaccepteerd ---
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  await page.locator(`${testpFormSel} input[type="file"]`).setInputFiles({ name: 'testfoto.png', mimeType: 'image/png', buffer: tinyPng });
  await page.click(`${testpFormSel} button[type="submit"]`);
  await page.waitForLoadState('networkidle');
  text = await page.textContent('body');
  assert(!text.includes('Alleen JPEG, PNG of WEBP'), 'een geldige afbeelding wordt zonder foutmelding geaccepteerd');
  const photoSrc = await page.locator(`${testpFormSel} >> xpath=.. >> img`).getAttribute('src');
  assert(photoSrc === '/admin/gebruikers/testp/photo', 'na een geslaagde upload staat de foto als <img>-tag op de kaart van de deelnemer, wijzend naar de eigen foto-route');

  // --- de foto zelf is ook echt op te vragen (als beheerder) ---
  const photoResp = await page.request.get(BASE + photoSrc);
  assert(photoResp.ok(), 'de geüploade foto is als afbeelding op te vragen');
  assert((photoResp.headers()['content-type'] || '').startsWith('image/'), 'de foto komt terug met een afbeeldings-content-type');
}

// --- groep, reden van stoppen (pulldowns) en toegangs-vinkje: drie losse velden per
// deelnemer (groep sinds versie 1.13.0, de andere twee sinds 1.12.0). De pulldowns zijn puur
// informatief; het vinkje bepaalt écht of iemand nog bij de dagelijkse oefening kan komen
// (los van de betaaldatum). ---
{
  const testpFormSel = 'form[action="/admin/gebruikers/testp"]';
  await page.selectOption(`${testpFormSel} select[name="groupName"]`, 'Roef 09.30');
  await page.selectOption(`${testpFormSel} select[name="stopReason"]`, 'gezondheid');
  await page.setChecked(`${testpFormSel} input[name="accessEnabled"]`, false);
  await page.click(`${testpFormSel} button[type="submit"]`);
  await page.waitForLoadState('networkidle');
  text = await page.textContent('body');
  assert(text.includes('Groep: Roef 09.30'), 'de gekozen groep verschijnt op de kaart van de deelnemer');
  assert(text.includes('Gezondheidsredenen'), 'de gekozen reden van stoppen verschijnt als badge op de kaart van de deelnemer');
  assert(text.includes('Toegang uitgezet'), 'het uitzetten van het toegangs-vinkje verschijnt als badge op de kaart van de deelnemer');

  // --- een deelnemer met uitgezette toegang komt niet meer bij de dagelijkse oefening,
  // ook al is het abonnement verder gewoon actief (dit is dus geen kopie van de al bestaande
  // "verlopen"-controle, maar een eigen, los in te stellen schakelaar) ---
  await page.click('button:has-text("Uitloggen")');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="username"]', 'testp');
  await page.fill('input[name="credential"]', '0611122233');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  text = await page.textContent('body');
  assert(text.includes('Je account is niet actief'), 'een deelnemer met uitgezette toegang ziet een duidelijk "niet actief"-scherm i.p.v. de dagelijkse flow');
  assert(text.includes('06-28440641'), 'op het "niet actief"-scherm staat sinds versie 1.14.0 ook een telefoonnummer');
  assert(text.includes('Bij geen direct gehoor, wordt binnen 24 uur contact met u opgenomen.'), 'op het "niet actief"-scherm staat sinds versie 1.14.0 ook de 24-uurs-tekst');
  assert(
    (await page.locator('a[href="tel:0628440641"]').count()) > 0,
    'het telefoonnummer op het "niet actief"-scherm is een klikbare tel:-link'
  );
  await page.goto(BASE + '/video');
  text = await page.textContent('body');
  assert(text.includes('Je account is niet actief'), 'ook rechtstreeks naar /video komt een deelnemer met uitgezette toegang niet bij de oefening');

  // --- weer inloggen als beheerder, en testp's toegang weer aanzetten zodat een volgende
  // testrun (en de brute-force-test hierna, die ook met testp inlogt) niet blijft hangen
  // op een bewust uitgezette toegang ---
  await page.click('button:has-text("Uitloggen")');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="username"]', 'beheerder');
  await page.fill('input[name="credential"]', 'test-admin-123');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.click('a[href="/admin/gebruikers"]');
  await page.waitForLoadState('networkidle');
  await page.selectOption(`${testpFormSel} select[name="groupName"]`, '');
  await page.selectOption(`${testpFormSel} select[name="stopReason"]`, '');
  await page.setChecked(`${testpFormSel} input[name="accessEnabled"]`, true);
  await page.click(`${testpFormSel} button[type="submit"]`);
  await page.waitForLoadState('networkidle');
  text = await page.textContent('body');
  assert(!text.includes('Toegang uitgezet'), 'toegang weer aanzetten verwijdert de badge weer');
  assert(!text.includes('Groep: Roef 09.30'), 'de groep weer op "Geen groep" zetten verwijdert de "Groep: ..."-regel weer');
}

// --- betaaldatum van corrie in het verleden zetten via het bewerkformulier ---
const corrieForm = await page.$('form[action="/admin/gebruikers/corrie"]');
await corrieForm.$eval('input[name="paidUntil"]', (el) => (el.value = '2020-01-01'));
await corrieForm.$eval('button[type="submit"]', (el) => el.click());
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(text.includes('Verlopen sinds'), 'na het aanpassen van de betaaldatum naar het verleden toont de badge "Verlopen sinds"');

// --- brute-force bescherming: 5x verkeerd inloggen sluit het account tijdelijk af ---
await page.click('button:has-text("Uitloggen")');
await page.waitForLoadState('networkidle');
for (let i = 0; i < 5; i++) {
  await page.fill('input[name="username"]', 'testp');
  await page.fill('input[name="credential"]', '0000000000');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}
// de 5e mislukte poging zet de vergrendeling pas server-side; een volgende poging laat 'm zien
await page.fill('input[name="username"]', 'testp');
await page.fill('input[name="credential"]', '0611122233');
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(text.includes('Te veel mislukte pogingen'), 'na 5 mislukte pogingen wordt het account tijdelijk vergrendeld, ook met het juiste nummer');

// --- video-pagina met een échte (niet-ontwikkelmodus) videokoppeling: na afloop moet de
// browser naar /voortgang gaan (het beloningsscherm), niet naar een vast adres in de code.
// Dit pad wordt hierboven niet gedekt: zonder Cloudflare-instellingen draait de app altijd
// in ontwikkelmodus (het gewone HTML-formulier), terwijl een échte video via JavaScript
// (fetch + "Video uitgekeken?"-knop) afgehandeld wordt. Render daarom hier los de
// video-pagina met een neptoken, zodat dat JavaScript-pad ook automatisch gecontroleerd
// wordt — dit ving eerder een echte fout op (een vast adres i.p.v. het serveradres volgen).
{
  const html = views.videoPage({
    schedule: { joint: 'Heup' },
    streamEmbedSrc: 'https://example.invalid/fake/iframe',
    devMode: false,
    durationSec: 1, // korte wachttijd, zodat de noodknop snel verschijnt in de test
  });
  writeFileSync('/tmp/_browsertest_video_redirect.html', html);

  const videoPage2 = await browser.newPage();
  let attemptedNavigation = null;
  videoPage2.on('requestfailed', (req) => { if (req.isNavigationRequest()) attemptedNavigation = req.url(); });
  videoPage2.on('framenavigated', (frame) => { attemptedNavigation = attemptedNavigation || frame.url(); });
  // Doet zich voor als het antwoord van de server op POST /video/complete: een fetch die
  // (na het volgen van de 302-redirect) eindigt op /voortgang.
  await videoPage2.addInitScript(() => {
    window.fetch = () => Promise.resolve({ url: 'https://example.invalid/voortgang', ok: true });
  });
  await videoPage2.goto('file:///tmp/_browsertest_video_redirect.html');
  await videoPage2.waitForSelector('#fallback-button', { state: 'visible', timeout: 10000 });
  await videoPage2.click('#fallback-button');
  await videoPage2.waitForTimeout(1500);
  assert(
    !!attemptedNavigation && attemptedNavigation.includes('/voortgang'),
    'na een échte (niet-ontwikkelmodus) video gaat de browser naar /voortgang (het beloningsscherm), niet naar een vast adres'
  );
  await videoPage2.close();
}

// --- beloningsvideo's: een volledig afgeronde trainingsweek (7 van de 7 dagen) ontgrendelt
// de eerstvolgende video uit de lijst die de beheerder heeft geüpload (op volgorde). Dit
// vraagt om een gecontroleerde, "perfecte" week — die kan niet via de normale flow (dat
// duurt 7 echte dagen), dus wordt hier rechtstreeks in de database klaargezet.
{
  const { rows: corrieRows } = await pool.query("SELECT id, created_at FROM users WHERE username = 'corrie'");
  const corrieId = corrieRows[0].id;
  const originalCreatedAt = corrieRows[0].created_at;

  const todayIsoStr = todayIso();
  const todayDate = new Date(todayIsoStr + 'T00:00:00');
  const cycleStartDate = new Date(todayDate.getTime() - 6 * 86400000);
  const anchorIsoStr = isoDateLocal(cycleStartDate);

  // Aanmelddatum zo zetten dat "vandaag" precies dag 7 van corrie's cyclus is, en alle 7
  // dagen van die cyclus vullen met een voltooide training — een perfecte week.
  await pool.query('UPDATE users SET created_at = $2 WHERE id = $1', [corrieId, anchorIsoStr]);
  await pool.query('DELETE FROM completions WHERE user_id = $1', [corrieId]);
  // Ook de per-video afvinkjes opruimen (o.a. de 4 video_completions-rijen die de vorige
  // testblokken hierboven voor "vandaag" hebben weggeschreven) — anders telt "vandaag" al
  // als voltooid en verstoort dat de dagbolletjes die hierna berekend worden.
  await pool.query('DELETE FROM video_completions WHERE user_id = $1', [corrieId]);
  for (let i = 0; i < 7; i++) {
    const d = new Date(cycleStartDate.getTime() + i * 86400000);
    await pool.query(
      'INSERT INTO completions (user_id, date) VALUES ($1, $2) ON CONFLICT (user_id, date) DO NOTHING',
      [corrieId, isoDateLocal(d)]
    );
  }

  // Zonder een geüploade beloningsvideo verandert er niets aan het bestaande gedrag —
  // gewoon de tekst "Compleet!", geen video. Dit voorkomt dat deze nieuwe functionaliteit
  // iets breekt zolang Herman nog geen enkele video heeft geüpload. (Er is op dit punt in
  // de testreeks geen actieve sessie meer — de vorige stap testte juist een mislukte login
  // — dus hier gewoon opnieuw inloggen als corrie.)
  await page.goto(BASE + '/login');
  await page.fill('input[name="username"]', 'corrie');
  await page.fill('input[name="credential"]', '06 12 34 56 78');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.goto(BASE + '/voortgang');
  text = await page.textContent('body');
  assert(text.includes('Compleet'), 'een perfecte week (7/7) zonder geüploade beloningsvideo toont nog gewoon "Compleet!"');
  assert(!text.includes('beloningsvideo') && !text.includes('ontgrendeld'), 'zonder geüploade beloningsvideo verschijnt er geen verwijzing naar een ontgrendelde video');

  // Nu een (nep) beloningsvideo klaarzetten zoals de beheerder dat via /admin/videos zou
  // doen, en controleren dat die na een perfecte week ook echt tevoorschijn komt.
  const { rows: videoRows } = await pool.query(
    `INSERT INTO reward_videos (label, video_uid, video_status) VALUES ($1, $2, 'ready') RETURNING id`,
    ['Testvideo over bewegen', 'fake-uid-voor-test']
  );
  await page.goto(BASE + '/voortgang');
  text = await page.textContent('body');
  assert(text.includes('Testvideo over bewegen'), 'na een perfecte week (7/7) met een klaarstaande video verschijnt de titel van de ontgrendelde beloningsvideo');
  assert(text.includes('Cloudflare Stream is nog niet ingesteld'), 'zonder Cloudflare-configuratie toont de ontgrendelde video hier een duidelijke melding in plaats van vast te lopen');

  // Opruimen: de testvideo weer verwijderen en corrie's aanmelddatum/trainingen terugzetten
  // zoals ze waren, zodat een volgende testrun weer van een schone lei begint.
  await pool.query('DELETE FROM reward_videos WHERE id = $1', [videoRows[0].id]);
  await pool.query('UPDATE users SET created_at = $2 WHERE id = $1', [corrieId, originalCreatedAt.toISOString()]);
  await pool.query('DELETE FROM completions WHERE user_id = $1', [corrieId]);
  await pool.query('DELETE FROM video_completions WHERE user_id = $1', [corrieId]);
}

await browser.close();
await pool.end();
console.log('\nAlle controles op de echte applicatie zijn geslaagd.');
