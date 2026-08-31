import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from './db.js';
import {
  normalizePhone, hashPassword, verifyPassword, isLocked, registerFailedAttempt,
  clearFailedAttempts, createSession, destroySession, userForSessionToken,
  sessionCookieOptions, SESSION_COOKIE, isExpired,
} from './auth.js';
import { jointForDate, isoDateLocal, todayIso, JOINTS_BY_WEEKDAY } from './helpers.js';
import { createDirectUploadUrl, getVideoStatus, createSignedPlaybackToken } from './cloudflareStream.js';
import * as views from './views.js';

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const cfConfigured = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

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
  if (isExpired(req.user)) return res.send(views.expiredPage({ user: req.user }));

  const today = todayIso();
  const { rows: schedRows } = await pool.query('SELECT * FROM schedule WHERE date = $1', [today]);
  const schedule = schedRows[0] || null;

  const { rows: doneRows } = await pool.query(
    'SELECT 1 FROM completions WHERE user_id = $1 AND date = $2', [req.user.id, today]
  );
  const done = doneRows.length > 0;

  // voortgang van de laatste 7 dagen, voor de puntjes-weergave
  const { rows: recentRows } = await pool.query(
    `SELECT date FROM completions WHERE user_id = $1 AND date >= $2::date - interval '6 days'`,
    [req.user.id, today]
  );
  const doneDates = new Set(recentRows.map((r) => isoDateLocal(r.date)));
  const dots = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = isoDateLocal(d);
    dots.push(`<span title="${iso}" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 3px;background:${doneDates.has(iso) ? '#3A6B60' : '#E7DFCF'};"></span>`);
  }

  res.send(views.vandaagPage({ user: req.user, schedule, done, weekDots: dots.join('') }));
});

app.get('/video', requireRole('senior'), async (req, res) => {
  if (isExpired(req.user)) return res.redirect('/vandaag');
  const today = todayIso();

  const { rows: doneRows } = await pool.query(
    'SELECT 1 FROM completions WHERE user_id = $1 AND date = $2', [req.user.id, today]
  );
  if (doneRows.length > 0) return res.redirect('/vandaag');

  const { rows: schedRows } = await pool.query('SELECT * FROM schedule WHERE date = $1', [today]);
  const schedule = schedRows[0];
  if (!schedule) return res.redirect('/vandaag');

  let streamEmbedSrc = null;
  if (cfConfigured && schedule.video_status === 'ready' && schedule.video_uid && process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE) {
    try {
      const token = await createSignedPlaybackToken(schedule.video_uid);
      streamEmbedSrc = `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${token}/iframe`;
    } catch (err) {
      console.error('Kon geen afspeel-token maken:', err.message);
    }
  }

  res.send(views.videoPage({ schedule, streamEmbedSrc, devMode: !streamEmbedSrc }));
});

app.post('/video/complete', requireRole('senior'), async (req, res) => {
  const today = todayIso();
  await pool.query(
    'INSERT INTO completions (user_id, date) VALUES ($1, $2) ON CONFLICT (user_id, date) DO NOTHING',
    [req.user.id, today]
  );
  res.redirect('/vandaag');
});

// --- beheerder: planning ---
app.get('/admin/planning', requireRole('admin'), async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = isoDateLocal(d);
    days.push({ date: iso, joint: jointForDate(d) });
  }
  const { rows } = await pool.query(
    'SELECT * FROM schedule WHERE date >= $1 AND date < $1::date + interval \'14 days\' ORDER BY date',
    [days[0].date]
  );
  const byDate = new Map(rows.map((r) => [isoDateLocal(r.date), r]));
  const merged = days.map((d) => ({ ...d, ...(byDate.get(d.date) || {}), date: d.date }));

  res.send(views.planningPage({ days: merged, cfConfigured }));
});

app.post('/admin/planning/:date/upload-url', requireRole('admin'), async (req, res) => {
  try {
    const { uploadUrl, uid } = await createDirectUploadUrl();
    res.json({ uploadUrl, uid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/planning/:date/attach', requireRole('admin'), async (req, res) => {
  const { date } = req.params;
  const { uid, label } = req.body;
  const d = new Date(date + 'T00:00:00');
  const joint = jointForDate(d);
  try {
    const status = await getVideoStatus(uid);
    await pool.query(
      `INSERT INTO schedule (date, joint, video_uid, video_label, duration_sec, video_status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (date) DO UPDATE SET joint = $2, video_uid = $3, video_label = $4, duration_sec = $5, video_status = $6, updated_at = now()`,
      [date, joint, uid, label || null, status.durationSec, status.ready ? 'ready' : 'processing']
    );
    res.json({ ok: true, ready: status.ready });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- beheerder: gebruikers ---
app.get('/admin/gebruikers', requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY role DESC, display_name');
  res.send(views.usersPage({ users: rows, error: null }));
});

app.post('/admin/gebruikers', requireRole('admin'), async (req, res) => {
  const username = String(req.body.username || '').trim();
  const displayName = String(req.body.displayName || '').trim() || username;
  const role = req.body.role === 'admin' ? 'admin' : 'senior';
  const phoneRaw = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');
  const paidUntil = req.body.paidUntil || null;

  const fail = async (error) => {
    const { rows } = await pool.query('SELECT * FROM users ORDER BY role DESC, display_name');
    res.status(400).send(views.usersPage({ users: rows, error }));
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

app.post('/admin/gebruikers/:username', requireRole('admin'), async (req, res) => {
  const { username } = req.params;
  const displayName = String(req.body.displayName || '').trim();
  const phoneRaw = req.body.phone != null ? String(req.body.phone).trim() : undefined;
  const paidUntil = req.body.paidUntil || null;

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const target = rows[0];
  if (!target) return res.redirect('/admin/gebruikers');

  const fields = ['display_name = $2'];
  const params = [username, displayName || target.display_name];
  if (target.role !== 'admin') {
    if (phoneRaw) {
      fields.push(`phone = $${params.length + 1}`); params.push(normalizePhone(phoneRaw));
      fields.push(`phone_display = $${params.length + 1}`); params.push(phoneRaw);
    }
    fields.push(`paid_until = $${params.length + 1}`); params.push(paidUntil || null);
  }
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE username = $1`, params);
  res.redirect('/admin/gebruikers');
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
