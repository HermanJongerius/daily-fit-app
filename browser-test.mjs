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

// --- naar de oefening, en in dev-modus als uitgekeken markeren ---
await page.click('a[href="/video"]');
await page.waitForLoadState('networkidle');
text = await page.textContent('body');
assert(text.includes('Ontwikkelmodus'), 'zonder Cloudflare-configuratie verschijnt de ontwikkelmodus-notitie');
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');
assert(page.url().endsWith('/voortgang'), 'na het markeren als uitgekeken verschijnt eerst het voortgangsscherm (cyclus-onthulling)');
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
    headerRow.join('|') === ['Naam', 'Mobiel nummer', 'Betaald tot', 'Status', 'Aangemeld op', 'Aantal keer getraind', 'Mogelijke traindagen', 'Percentage getraind'].join('|'),
    'de Excel-export heeft de verwachte kolomkoppen'
  );
  const rows = [];
  sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(row.values.slice(1)); });
  const testRow = rows.find((r) => r[0] === 'Test Persoon');
  assert(!!testRow, 'de nieuw aangemaakte senior staat ook in de Excel-export');
  assert(testRow[1] === '0611122233', 'het telefoonnummer in de export klopt');
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
}

await browser.close();
await pool.end();
console.log('\nAlle controles op de echte applicatie zijn geslaagd.');
