import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ontbreekt. Zet die in .env (lokaal) of als omgevingsvariabele (Railway).');
}

// Bepaalt of er SSL gebruikt moet worden, op basis van het hostgedeelte van DATABASE_URL:
// - lokaal (localhost/127.0.0.1): geen SSL.
// - Railway's eigen interne netwerk (*.railway.internal, gebruikt wanneer de app en de
//   database in hetzelfde project staan): geen SSL — dat verkeer verlaat Railway's netwerk
//   nooit en de interne database ondersteunt zelf geen SSL-handshake. Dit forceren gaf
//   precies de "Internal Server Error" die hier is opgelost.
// - al het overige (bijvoorbeeld een publieke/externe database-verbinding): SSL aan, met
//   rejectUnauthorized: false omdat dit soort verbindingen vaak een zelfondertekend
//   certificaat gebruiken.
function shouldUseSSL(connectionString) {
  try {
    const { hostname } = new URL(connectionString);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    if (hostname.endsWith('.railway.internal')) return false;
    return true;
  } catch {
    return true;
  }
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSSL(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
});

export async function query(text, params) {
  return pool.query(text, params);
}
