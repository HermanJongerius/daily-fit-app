import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool } from './db.js';
import {
  normalizePhone, hashPassword, verifyPassword, isLocked, registerFailedAttempt,
  clearFailedAttempts, createSession, destroySession, userForSessionToken,
  sessionCookieOptions, SESSION_COOKIE, isExpired, isAccessDisabled,
} from './auth.js';
import { jointForDate, isoDateLocal, todayIso, weekdayInAppTz, JOINTS_BY_WEEKDAY, DAY_LETTERS_BY_WEEKDAY, cycleInfoForUser, daysPossibleSince, stopReasonLabel, groupLabel } from './helpers.js';
import { createDirectUploadUrl, getVideoStatus, createSignedPlaybackToken } from './cloudflareStream.js';
import * as views from './views.js';

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const cfConfigured = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

// --- pasfoto per deelnemer (sinds versie 1.12.0) — rechtstreeks in de database bewaard, zie
// schema.sql. Kleine bestandsgrootte-limiet en alleen gangbare afbeeldingsformaten, ruim
// genoeg voor een simpele pasfoto maar niet zo groot dat het de database onnodig belast.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('ONLY_IMAGES'));
    }
    cb(null, true);
  },
});
// Zet een multer-fout om in een Nederlandse foutmelding (te groot / verkeerd bestandstype) in
// plaats van de request te laten crashen — de route hieronder toont 'm dan netjes op het scherm.
function uploadPhotoMiddleware(req, res, next) {
  photoUpload.single('photo')(req, res, (err) => {
    if (err) {
      req.photoError = err.code === 'LIMIT_FILE_SIZE'
        ? 'De foto is te groot (max. 5 MB).'
        : 'Alleen JPEG, PNG of WEBP-afbeeldingen zijn toegestaan als foto.';
    }
    next();
  });
}

// --- gebruiker uit sessie-cookie halen ---
app.use(async (req, res, next) => {
  try {
    req.user = await userForSessionToken(req.cookies[SESSION_COOKIE]);
  } catch (err) {
    console.error('Sessie-lookup mislukt:', err);
    req.user = null;
  }
  next();
});

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== role) return res.redirect(req.user.role === 'admin' ? '/admin/planning' : '/vandaag');
    next();
  };
}

// --- root: doorsturen op basis van rol ---
app.get('/', (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.redirect(req.user.role === 'admin' ? '/admin/planning' : '/vandaag');
});

// --- inloggen ---
app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.send(views.loginPage({ error: null }));
});

app.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const credential = String(req.body.credential || '');
  const generic = 'Gebruikersnaam of wachtwoord/mobiel nummer klopt niet.';

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0];

  if (!user) return res.status(401).send(views.loginPage({ error: generic }));
  if (await isLocked(user)) {
    return res.status(429).send(views.loginPage({ error: 'Te veel mislukte pogingen. Probeer het over een paar minuten opnieuw.' }));
  }

  const ok = user.role === 'admin'
    ? await verifyPassword(credential, user.password_hash)
    : !!credential && normalizePhone(user.phone) === normalizePhone(credential);

  if (!ok) {
    await registerFailedAttempt(user.id);
    return res.status(401).send(views.loginPage({ error: generic }));
  }

  await clearFailedAttempts(user.id);
  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.redirect(user.role === 'admin' ? '/admin/planning' : '/vandaag');
});

app.post('/logout', async (req, res) => {
  await destroySession(req.cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.redirect('/login');
});

// --- senior: dagelijkse flow ---
app.get('/vandaag', requireRole('senior'), async (req, res) => {
  // Handmatige toegangsschakelaar (zie 4h/4i in technisch-ontwerp.md) gaat vóór de
  // betaaldatum-controle: een beheerder die iemands toegang expliciet heeft uitgezet, moet
  // dat effect direct zien, ook als het abonnement zelf nog actief is.
  if (isAccessDisabled(req.user)) return res.send(views.accessDisabledPage({ user: req.user }));
  if (isExpired(req.user)) return res.send(views.expiredPage({ user: req.user }));

  const today = todayIso();
  // Sinds versie 1.11.0 staan er per dag 4 video's gepland (slot 1 t/m 4) i.p.v. 1 — zie
  // schema.sql. "schedule" is dus voortaan een lijst (0 t/m 4 rijen), niet meer één rij.
  const { rows: schedule } = await pool.query('SELECT * FROM schedule WHERE date = $1 ORDER BY slot', [today]);

  const { rows: doneRows } = await pool.query(
    'SELECT 1 FROM completions WHERE user_id = $1 AND date = $2', [req.user.id, today]
  );
  const done = doneRows.length > 0;

  // Voor de tekst op de startknop ("Start de oefeningen" vs. "Verder — 2 van 4 gedaan"):
  // hoeveel van de 4 video's van vandaag heeft deze deelnemer al afgevinkt? Alleen relevant
  // als de dag nog niet als geheel is afgerond (done=false).
  let videosDoneToday = 0;
  if (!done) {
    const { rows: vcRows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM video_completions WHERE user_id = $1 AND date = $2', [req.user.id, today]
    );
    videosDoneToday = vcRows[0].n;
  }

  // voortgang van de huidige week (altijd maandag t/m zondag, in die volgorde), voor de
  // puntjes-weergave — niet de laatste 7 dagen teruggerekend vanaf vandaag.
  // Let op: dit gaat uit van de Nederlandse dag/weekdag (weekdayInAppTz), niet van de
  // tijdzone van de server zelf — anders kan hier het verkeerde dagbolletje oplichten.
  const dayOfWeek = weekdayInAppTz(); // 0=zo..6=za (JS getDay())
  const daysSinceMonday = (dayOfWeek + 6) % 7; // ma=0 .. zo=6
  const monday = new Date(Date.now() - daysSinceMonday * 86400000);
  const { rows: recentRows } = await pool.query(
    `SELECT date FROM completions WHERE user_id = $1 AND date >= $2::date`,
    [req.user.id, isoDateLocal(monday)]
  );
  const doneDates = new Set(recentRows.map((r) => isoDateLocal(r.date)));
  const dots = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 86400000);
    const iso = isoDateLocal(d);
    const isDone = doneDates.has(iso);
    const letter = DAY_LETTERS_BY_WEEKDAY[weekdayInAppTz(d)];
    dots.push(`<span title="${iso}" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;margin:0 3px;font-size:11px;font-weight:800;background:${isDone ? '#3A6B60' : '#E7DFCF'};color:${isDone ? '#FBF6EC' : '#746C5F'};">${letter}</span>`);
  }

  // Nieuwsbericht van vandaag (sinds versie 1.15.0, zie news_items in schema.sql) — alleen
  // getoond als de beheerder er daadwerkelijk één voor deze datum heeft klaargezet.
  const { rows: newsRows } = await pool.query('SELECT message FROM news_items WHERE date = $1', [today]);
  const newsMessage = newsRows.length ? newsRows[0].message : null;

  res.send(views.vandaagPage({ user: req.user, schedule, done, videosDoneToday, weekDots: dots.join(''), newsMessage }));
});

// Bepaalt server-side (dus niet te beïnvloeden vanaf de client) welk van de 4 video's van
// vandaag voor deze deelnemer nu aan de beurt is: het laagste slotnummer (1-4) dat nog geen
// rij in video_completions heeft. Wordt zowel door GET /video (welke video tonen) als door
// POST /video/complete (welke video als afgerond markeren) gebruikt, zodat afvinken altijd
// keurig op volgorde gaat — ook als iemand de pagina ververst of het scherm sluit en later
// diezelfde dag terugkomt (dan gaat het gewoon verder bij de eerstvolgende, niet-afgevinkte
// video, zie technisch-ontwerp.md sectie 4a).
async function nextUnfinishedSlot(userId, dateIso) {
  const { rows } = await pool.query(
    'SELECT slot FROM video_completions WHERE user_id = $1 AND date = $2', [userId, dateIso]
  );
  const done = new Set(rows.map((r) => r.slot));
  return [1, 2, 3, 4].find((s) => !done.has(s)) || null;
}

app.get('/video', requireRole('senior'), async (req, res) => {
  if (isAccessDisabled(req.user)) return res.redirect('/vandaag');
  if (isExpired(req.user)) return res.redirect('/vandaag');
  const today = todayIso();

  const { rows: doneRows } = await pool.query(
    'SELECT 1 FROM completions WHERE user_id = $1 AND date = $2', [req.user.id, today]
  );
  if (doneRows.length > 0) return res.redirect('/vandaag');

  const { rows: schedRows } = await pool.query('SELECT * FROM schedule WHERE date = $1 ORDER BY slot', [today]);
  // Pas beginnen als alle 4 slots klaarstaan — anders (net als vroeger bij 1 video) terug
  // naar "Vandaag", dat dan de "wordt nog klaargezet"-tekst toont.
  if (schedRows.length < 4 || schedRows.some((s) => s.video_status !== 'ready')) return res.redirect('/vandaag');

  const slot = await nextUnfinishedSlot(req.user.id, today);
  if (!slot) return res.redirect('/vandaag'); // veiligheid: zou hier niet moeten kunnen komen
  const schedule = schedRows.find((s) => s.slot === slot);
  const completedSlots = schedRows.filter((s) => s.slot < slot).map((s) => s.slot);

  let streamEmbedSrc = null;
  if (cfConfigured && schedule.video_status === 'ready' && schedule.video_uid && process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE) {
    try {
      const token = await createSignedPlaybackToken(schedule.video_uid);
      streamEmbedSrc = `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${token}/iframe`;
    } catch (err) {
      console.error('Kon geen afspeel-token maken:', err.message);
    }
  }

  res.send(views.videoPage({
    schedule, streamEmbedSrc, devMode: !streamEmbedSrc, durationSec: schedule.duration_sec,
    slot, totalSlots: 4, completedSlots,
  }));
});

app.post('/video/complete', requireRole('senior'), async (req, res) => {
  const today = todayIso();
  // Welk slot dit precies is, bepaalt de server zelf (zie nextUnfinishedSlot hierboven) —
  // er wordt geen slotnummer van de client aangenomen, zodat afvinken altijd op volgorde
  // gaat, ook als iemand handmatig een POST naar deze route zou proberen te sturen.
  const slot = await nextUnfinishedSlot(req.user.id, today);
  if (slot) {
    await pool.query(
      'INSERT INTO video_completions (user_id, date, slot) VALUES ($1, $2, $3) ON CONFLICT (user_id, date, slot) DO NOTHING',
      [req.user.id, today, slot]
    );
  }
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM video_completions WHERE user_id = $1 AND date = $2', [req.user.id, today]
  );
  if (countRows[0].n >= 4) {
    // Alle 4 video's van vandaag zijn afgevinkt: pas nú telt de dag als voltooid — dit is de
    // enige plek die in completions schrijft, dus alle bestaande logica die daarop steunt
    // (cyclus, dagbolletjes, trainingsstatistiek, beloningsvideo's) blijft ongewijzigd werken.
    await pool.query(
      'INSERT INTO completions (user_id, date) VALUES ($1, $2) ON CONFLICT (user_id, date) DO NOTHING',
      [req.user.id, today]
    );
    return res.redirect('/voortgang');
  }
  // Nog niet alle 4 gedaan: terug naar /video, dat vanzelf de eerstvolgende, nog niet
  // afgevinkte video laat zien — met het startscherm ("Start de video") ervoor, dat de
  // deelnemer zelf moet aantikken. Dat is de "zelf klikken tussen de video's"-stap.
  res.redirect('/video');
});

// --- voortgangsscherm (het "onthullingsscherm"): verschijnt na elke training, toont de
// persoonlijke 7-daagse cyclus als een plaatje dat vakje voor vakje onthuld wordt. Bij een
// volledig afgeronde cyclus (7 van de 7 dagen) wordt bovendien — als er één beschikbaar is
// — een informatie-video ontgrendeld, op volgorde (zie /admin/videos hieronder). ---
app.get('/voortgang', requireRole('senior'), async (req, res) => {
  const today = todayIso();
  const { dayInCycle, cycleStartIso, cycleEndIso, anchorIso } = cycleInfoForUser(req.user.created_at, today);
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM completions WHERE user_id = $1 AND date >= $2::date AND date <= $3::date',
    [req.user.id, cycleStartIso, cycleEndIso]
  );
  const blocksRevealed = Math.min(7, rows[0].n);
  const isLastDay = dayInCycle === 7;
  const currentCyclePerfect = isLastDay && blocksRevealed === 7;

  let rewardVideo = null;
  let streamEmbedSrc = null;
  if (currentCyclePerfect) {
    // Tel hoeveel van de eerdere, al volledig afgelopen cycli (vóór de huidige) ook
    // "perfect" waren (7 van de 7 dagen) — dat bepaalt, samen met de huidige perfecte
    // cyclus, welke video in de lijst nu aan de beurt is (1e perfecte cyclus -> video 1,
    // 2e -> video 2, enzovoort).
    let perfectCyclesCompleted = 1; // de huidige cyclus telt zelf ook mee
    if (cycleStartIso > anchorIso) {
      const { rows: pastRows } = await pool.query(
        `SELECT FLOOR((date - $2::date) / 7)::int AS cycle_idx, COUNT(*)::int AS n
         FROM completions
         WHERE user_id = $1 AND date >= $2::date AND date < $3::date
         GROUP BY cycle_idx`,
        [req.user.id, anchorIso, cycleStartIso]
      );
      perfectCyclesCompleted += pastRows.filter((r) => r.n === 7).length;
    }

    const { rows: readyVideos } = await pool.query(
      "SELECT * FROM reward_videos WHERE video_status = 'ready' ORDER BY id ASC"
    );
    if (readyVideos.length > 0) {
      // Is de lijst "op" (meer perfecte cycli dan geüploade video's), dan blijft gewoon de
      // laatst toegevoegde video staan totdat Herman er een nieuwe aan toevoegt.
      const idx = Math.min(perfectCyclesCompleted, readyVideos.length) - 1;
      rewardVideo = readyVideos[idx];
      if (cfConfigured && rewardVideo.video_uid && process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE) {
        try {
          const token = await createSignedPlaybackToken(rewardVideo.video_uid);
          streamEmbedSrc = `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${token}/iframe`;
        } catch (err) {
          console.error('Kon geen afspeel-token maken voor de beloningsvideo:', err.message);
        }
      }
    }
  }

  res.send(views.voortgangPage({ dayInCycle, blocksRevealed, rewardVideo, streamEmbedSrc }));
});

// --- beheerder: planning ---
// Sinds versie 1.11.0 staan er per dag 4 video's gepland (slot 1 t/m 4) i.p.v. 1 — een
// gewricht moet vanuit meerdere kanten bewogen worden. Elke dag krijgt dus 4 upload-slots.
app.get('/admin/planning', requireRole('admin'), async (req, res) => {
  // Start bij "vandaag" volgens de Nederlandse klok (todayIso), niet volgens de tijdzone
  // van de server zelf — zie de toelichting bij APP_TIMEZONE in helpers.js.
  const start = new Date(todayIso() + 'T00:00:00');
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = isoDateLocal(d);
    days.push({ date: iso, joint: jointForDate(d) });
  }
  const { rows } = await pool.query(
    'SELECT * FROM schedule WHERE date >= $1 AND date < $1::date + interval \'14 days\' ORDER BY date, slot',
    [days[0].date]
  );
  const bySlot = new Map(rows.map((r) => [`${isoDateLocal(r.date)}:${r.slot}`, r]));
  const merged = days.map((d) => ({
    ...d,
    slots: [1, 2, 3, 4].map((slot) => ({
      slot,
      video_status: 'none',
      ...(bySlot.get(`${d.date}:${slot}`) || {}),
      date: d.date, // altijd de iso-string gebruiken, niet het Date-object dat pg voor "date" teruggeeft
    })),
  }));

  // Cloudflare is soms nog even bezig met het verwerken van een net geüploade video
  // (de status stond op "processing" op het moment dat 'ie gekoppeld werd). Elke keer
  // dat de beheerder dit scherm opent, wordt dat voor openstaande video's opnieuw
  // gecontroleerd, zodat "Wordt verwerkt" vanzelf "Klaar" wordt zodra Cloudflare klaar is
  // — zonder dat de beheerder daar iets voor hoeft te doen.
  if (cfConfigured) {
    for (const day of merged) {
      for (const s of day.slots) {
        if (s.video_status === 'processing' && s.video_uid) {
          try {
            const status = await getVideoStatus(s.video_uid);
            if (status.ready) {
              await pool.query(
                'UPDATE schedule SET video_status = $3, duration_sec = $4, updated_at = now() WHERE date = $1 AND slot = $2',
                [day.date, s.slot, 'ready', status.durationSec]
              );
              s.video_status = 'ready';
              s.duration_sec = status.durationSec;
            }
          } catch (err) {
            console.error(`Kon status van video ${s.video_uid} (${day.date}, slot ${s.slot}) niet verversen:`, err.message);
          }
        }
      }
    }
  }

  res.send(views.planningPage({ days: merged, cfConfigured }));
});

app.post('/admin/planning/:date/:slot/upload-url', requireRole('admin'), async (req, res) => {
  try {
    const { uploadUrl, uid } = await createDirectUploadUrl();
    res.json({ uploadUrl, uid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/planning/:date/:slot/attach', requireRole('admin'), async (req, res) => {
  const { date } = req.params;
  const slot = parseInt(req.params.slot, 10);
  const { uid, label } = req.body;
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) {
    return res.status(400).json({ error: 'Ongeldig slotnummer (moet 1 t/m 4 zijn).' });
  }
  const d = new Date(date + 'T00:00:00');
  const joint = jointForDate(d);
  try {
    const status = await getVideoStatus(uid);
    await pool.query(
      `INSERT INTO schedule (date, slot, joint, video_uid, video_label, duration_sec, video_status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (date, slot) DO UPDATE SET joint = $3, video_uid = $4, video_label = $5, duration_sec = $6, video_status = $7, updated_at = now()`,
      [date, slot, joint, uid, label || null, status.durationSec, status.ready ? 'ready' : 'processing']
    );
    res.json({ ok: true, ready: status.ready });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- beheerder: informatie-video's ("beloningsvideo's") — worden één voor één, op
// volgorde, ontgrendeld zodra een deelnemer een hele trainingsweek (7 van de 7 dagen)
// afmaakt, zie /voortgang hierboven. Los van de dagelijkse planning: geen datum, gewoon
// een oplopende lijst waar steeds een nieuwe video aan toegevoegd kan worden. ---
app.get('/admin/videos', requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM reward_videos ORDER BY id ASC');

  // Zelfde vangnet als bij de dagelijkse planning: een net geüploade video kan bij
  // Cloudflare nog even op "processing" staan — dit wordt hier automatisch ververst.
  if (cfConfigured) {
    for (const v of rows) {
      if (v.video_status === 'processing' && v.video_uid) {
        try {
          const status = await getVideoStatus(v.video_uid);
          if (status.ready) {
            await pool.query('UPDATE reward_videos SET video_status = $2, duration_sec = $3 WHERE id = $1', [
              v.id, 'ready', status.durationSec,
            ]);
            v.video_status = 'ready';
            v.duration_sec = status.durationSec;
          }
        } catch (err) {
          console.error(`Kon status van informatie-video ${v.video_uid} niet verversen:`, err.message);
        }
      }
    }
  }

  res.send(views.videosPage({ videos: rows, cfConfigured }));
});

app.post('/admin/videos/upload-url', requireRole('admin'), async (req, res) => {
  try {
    const { uploadUrl, uid } = await createDirectUploadUrl();
    res.json({ uploadUrl, uid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/videos/attach', requireRole('admin'), async (req, res) => {
  const { uid, label } = req.body;
  try {
    const status = await getVideoStatus(uid);
    await pool.query(
      `INSERT INTO reward_videos (label, video_uid, duration_sec, video_status) VALUES ($1, $2, $3, $4)`,
      [label || null, uid, status.durationSec, status.ready ? 'ready' : 'processing']
    );
    res.json({ ok: true, ready: status.ready });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- beheerder: nieuwsberichten (sinds versie 1.15.0) — één bericht per datum, getoond op
// /vandaag zodra die datum is aangebroken. Los van de dagelijkse videoplanning en van de
// beloningsvideo's: puur tekst, geen Cloudflare-koppeling nodig. ---
app.get('/admin/news', requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM news_items ORDER BY date DESC');
  res.send(views.newsPage({ newsItems: rows, error: req.query.error || null }));
});

app.post('/admin/news', requireRole('admin'), async (req, res) => {
  const { date, message } = req.body;
  if (!date || !message || !message.trim()) {
    return res.redirect('/admin/news?error=' + encodeURIComponent('Vul zowel een datum als een bericht in.'));
  }
  // Eén bericht per datum: een tweede toevoeging op dezelfde datum overschrijft het
  // eerdere bericht (net als bij het opnieuw uploaden van een video voor dezelfde dag).
  await pool.query(
    `INSERT INTO news_items (date, message) VALUES ($1, $2)
     ON CONFLICT (date) DO UPDATE SET message = $2, updated_at = now()`,
    [date, message.trim()]
  );
  res.redirect('/admin/news');
});

app.post('/admin/news/:id/delete', requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM news_items WHERE id = $1', [req.params.id]);
  res.redirect('/admin/news');
});

// --- beheerder: gebruikers ---
// Haalt alle gebruikers op, plus per senior hoevaak ze in totaal getraind hebben en
// hoeveel procent dat is van het aantal dagen dat ze hadden kúnnen trainen (vanaf de
// dag van aanmelden tot en met vandaag). Beheerders trainen niet, dus die krijgen geen
// trainingsstatistiek.
async function loadUsersWithStats() {
  // Let op: "photo" (de pasfoto zelf, als bytes) wordt hier bewust niet opgehaald — dat zou
  // bij elke keer dat dit scherm geopend wordt de foto's van alle deelnemers in één keer
  // meesturen, terwijl de pagina alleen per deelnemer een klein rond fotootje toont (via een
  // eigen route, zie /admin/gebruikers/:username/photo). "photo_mime"/"photo_updated_at" wel,
  // want die bepalen alleen of er al een foto is, niet de foto zelf.
  const { rows } = await pool.query(
    `SELECT id, username, role, display_name, phone, phone_display, paid_until,
            failed_attempts, locked_until, created_at, photo_mime, photo_updated_at,
            stop_reason, access_enabled, group_name
     FROM users ORDER BY role DESC, display_name`
  );
  const { rows: completionCounts } = await pool.query(
    'SELECT user_id, COUNT(*)::int AS n FROM completions GROUP BY user_id'
  );
  const countByUser = new Map(completionCounts.map((r) => [r.user_id, r.n]));
  const today = todayIso();
  return rows.map((u) => {
    if (u.role !== 'senior') return u;
    const completed = countByUser.get(u.id) || 0;
    const possible = daysPossibleSince(u.created_at, today);
    const percent = possible > 0 ? Math.round((completed / possible) * 100) : 0;
    return { ...u, trainingStats: { completed, possible, percent } };
  });
}

app.get('/admin/gebruikers', requireRole('admin'), async (req, res) => {
  const users = await loadUsersWithStats();
  res.send(views.usersPage({ users, error: null }));
});

// --- export naar Excel: naam, telefoonnummer en trainingsvoortgang van alle deelnemers,
// zodat de beheerder dit ook buiten de app (bijv. om uit te printen of te delen) kan
// bijhouden. Alleen senioren komen in de lijst — het beheerder-account zelf traint niet.
app.get('/admin/gebruikers/export', requireRole('admin'), async (req, res) => {
  const users = await loadUsersWithStats();
  const seniors = users.filter((u) => u.role === 'senior');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DailyFit';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Deelnemers');

  sheet.columns = [
    { header: 'Naam', key: 'naam', width: 26 },
    { header: 'Groep', key: 'groep', width: 18 },
    { header: 'Mobiel nummer', key: 'telefoon', width: 18 },
    { header: 'Betaald tot', key: 'betaaldTot', width: 14, style: { numFmt: 'dd-mm-yyyy' } },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Toegang', key: 'toegang', width: 14 },
    { header: 'Reden van stoppen', key: 'redenStoppen', width: 22 },
    { header: 'Aangemeld op', key: 'aangemeld', width: 14, style: { numFmt: 'dd-mm-yyyy' } },
    { header: 'Aantal keer getraind', key: 'aantalGetraind', width: 20 },
    { header: 'Mogelijke traindagen', key: 'mogelijkeDagen', width: 20 },
    { header: 'Percentage getraind', key: 'percentage', width: 20, style: { numFmt: '0"%"' } },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle' };

  const today = todayIso();
  for (const u of seniors) {
    const status = !u.paid_until
      ? 'Geen betaaldatum'
      : isoDateLocal(u.paid_until) < today
        ? 'Verlopen'
        : 'Actief';
    sheet.addRow({
      naam: u.display_name,
      groep: groupLabel(u.group_name),
      telefoon: u.phone_display || '',
      betaaldTot: u.paid_until ? new Date(u.paid_until) : null,
      status,
      // "Toegang" (het handmatige vinkje) staat los van "Status" hierboven (dat gaat over de
      // betaaldatum) — zie isAccessDisabled in auth.js.
      toegang: u.access_enabled === false ? 'Uitgezet' : 'Actief',
      redenStoppen: stopReasonLabel(u.stop_reason),
      aangemeld: new Date(u.created_at),
      aantalGetraind: u.trainingStats ? u.trainingStats.completed : 0,
      mogelijkeDagen: u.trainingStats ? u.trainingStats.possible : 0,
      percentage: u.trainingStats ? u.trainingStats.percent : 0,
    });
  }

  const bestandsnaam = `dailyfit-deelnemers-${today}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${bestandsnaam}"`);
  await workbook.xlsx.write(res);
  res.end();
});

app.post('/admin/gebruikers', requireRole('admin'), async (req, res) => {
  const username = String(req.body.username || '').trim();
  const displayName = String(req.body.displayName || '').trim() || username;
  const role = req.body.role === 'admin' ? 'admin' : 'senior';
  const phoneRaw = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');
  const paidUntil = req.body.paidUntil || null;

  const fail = async (error) => {
    const users = await loadUsersWithStats();
    res.status(400).send(views.usersPage({ users, error }));
  };

  if (!username) return fail('Vul een gebruikersnaam in.');
  if (role === 'admin' && !password) return fail('Vul een wachtwoord in voor de beheerder.');
  if (role !== 'admin' && !phoneRaw) return fail('Vul een mobiel nummer in.');

  const { rows: existing } = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
  if (existing.length) return fail('Deze gebruikersnaam bestaat al.');

  try {
    if (role === 'admin') {
      const passwordHash = await hashPassword(password);
      await pool.query(
        'INSERT INTO users (username, role, display_name, password_hash) VALUES ($1, $2, $3, $4)',
        [username, role, displayName, passwordHash]
      );
    } else {
      await pool.query(
        'INSERT INTO users (username, role, display_name, phone, phone_display, paid_until) VALUES ($1, $2, $3, $4, $5, $6)',
        [username, role, displayName, normalizePhone(phoneRaw), phoneRaw, paidUntil || null]
      );
    }
    res.redirect('/admin/gebruikers');
  } catch (err) {
    console.error(err);
    fail('Er ging iets mis bij het aanmaken van het account.');
  }
});

app.post('/admin/gebruikers/:username', requireRole('admin'), uploadPhotoMiddleware, async (req, res) => {
  const { username } = req.params;
  const displayName = String(req.body.displayName || '').trim();
  const phoneRaw = req.body.phone != null ? String(req.body.phone).trim() : undefined;
  const paidUntil = req.body.paidUntil || null;

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const target = rows[0];
  if (!target) return res.redirect('/admin/gebruikers');

  if (req.photoError) {
    const users = await loadUsersWithStats();
    return res.status(400).send(views.usersPage({ users, error: req.photoError }));
  }

  const fields = ['display_name = $2'];
  const params = [username, displayName || target.display_name];
  if (target.role !== 'admin') {
    if (phoneRaw) {
      fields.push(`phone = $${params.length + 1}`); params.push(normalizePhone(phoneRaw));
      fields.push(`phone_display = $${params.length + 1}`); params.push(phoneRaw);
    }
    fields.push(`paid_until = $${params.length + 1}`); params.push(paidUntil || null);
    // "Reden van stoppen" (puur informatief) en het toegangs-vinkje zijn bewust twee losse
    // velden — zie schema.sql. Een leeg checkbox-veldje wordt door de browser helemaal niet
    // meegestuurd (vandaar de expliciete `=== 'on'`-check), dus die moet altijd bijgewerkt
    // worden — anders zou uitvinken van het vinkje nooit aankomen bij de server.
    fields.push(`stop_reason = $${params.length + 1}`); params.push(req.body.stopReason || null);
    fields.push(`access_enabled = $${params.length + 1}`); params.push(req.body.accessEnabled === 'on');
    fields.push(`group_name = $${params.length + 1}`); params.push(req.body.groupName || null);
    // Alleen als er daadwerkelijk een nieuw bestand is gekozen — een leeg gelaten
    // fotoveldje mag de al opgeslagen foto niet per ongeluk wissen.
    if (req.file) {
      fields.push(`photo = $${params.length + 1}`); params.push(req.file.buffer);
      fields.push(`photo_mime = $${params.length + 1}`); params.push(req.file.mimetype);
      fields.push('photo_updated_at = now()');
    }
  }
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE username = $1`, params);
  res.redirect('/admin/gebruikers');
});

// --- pasfoto van een deelnemer opvragen — alleen voor de beheerder, niet voor de deelnemer
// zelf of anderen (zie de gekozen scope: alleen zichtbaar in het beheerdersoverzicht). ---
app.get('/admin/gebruikers/:username/photo', requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query('SELECT photo, photo_mime FROM users WHERE username = $1', [req.params.username]);
  const row = rows[0];
  if (!row || !row.photo) return res.status(404).end();
  res.setHeader('Content-Type', row.photo_mime || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.end(row.photo);
});

// --- vangnet: elke onverwachte fout krijgt een nette Nederlandse pagina i.p.v. een kale
// "Internal Server Error", en wordt hier gelogd zodat de oorzaak terug te vinden is in de
// serverlogs (bij Railway: het tabblad "Deployments" -> de actieve deployment -> "Logs"). ---
app.use((err, req, res, next) => {
  console.error('Onverwachte fout op', req.method, req.originalUrl, ':', err);
  if (res.headersSent) return next(err);
  res.status(500).send(views.errorPage());
});

export default app;
