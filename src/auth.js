import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

// --- telefoonnummer-normalisatie (senior-login) ---
// Tolerant voor spaties, streepjes, haakjes en +31/0031-notatie, zodat "06 12 34 56 78",
// "06-12345678" en "+31612345678" allemaal als hetzelfde nummer worden herkend.
export function normalizePhone(raw) {
  let digits = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (digits.indexOf('31') === 0 && digits.length > 10) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}

// --- wachtwoord-hashing (alleen admin) ---
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// --- login-pogingen: kortstondige vergrendeling na herhaalde mislukte pogingen ---
// Voorkomt dat iemand snel achter elkaar mobiele nummers/wachtwoorden kan "raden".
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

export async function isLocked(user) {
  return !!(user.locked_until && new Date(user.locked_until) > new Date());
}

export async function registerFailedAttempt(userId) {
  const { rows } = await pool.query('SELECT failed_attempts FROM users WHERE id = $1', [userId]);
  const attempts = (rows[0]?.failed_attempts || 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await pool.query(
      "UPDATE users SET failed_attempts = 0, locked_until = now() + interval '" + LOCK_MINUTES + " minutes' WHERE id = $1",
      [userId]
    );
  } else {
    await pool.query('UPDATE users SET failed_attempts = $2 WHERE id = $1', [userId, attempts]);
  }
}

export async function clearFailedAttempts(userId) {
  await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [userId]);
}

// --- sessies: langlopend, zodat een gebruiker niet dagelijks opnieuw hoeft in te loggen ---
const SESSION_COOKIE = 'dailyfit_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365; // 1 jaar

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
  };
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId]);
  return token;
}

export async function destroySession(token) {
  if (!token) return;
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

export async function userForSessionToken(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1`,
    [token]
  );
  if (!rows[0]) return null;
  pool.query('UPDATE sessions SET last_seen_at = now() WHERE token = $1', [token]).catch(() => {});
  return rows[0];
}

export { SESSION_COOKIE };

export function isExpired(user) {
  if (user.role === 'admin') return false;
  if (!user.paid_until) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(user.paid_until) < today;
}
