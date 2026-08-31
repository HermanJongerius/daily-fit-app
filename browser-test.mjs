import pkg from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import { JOINTS_BY_WEEKDAY } from './src/helpers.js';

const expectedJointToday = JOINTS_BY_WEEKDAY[new Date().getDay()];

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
text = await page.textContent('body');
assert(text.includes('al bewogen'), 'na het markeren als uitgekeken toont /vandaag de "al bewogen"-status');

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

await browser.close();
console.log('\nAlle controles op de echte applicatie zijn geslaagd.');
