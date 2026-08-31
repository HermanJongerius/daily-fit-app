import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ontbreekt. Zet die in .env (lokaal) of als omgevingsvariabele (Railway).');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway's Postgres vereist SSL vanaf buiten hun eigen netwerk; lokaal (127.0.0.1) juist niet.
  ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false },
});

export async function query(text, params) {
  return pool.query(text, params);
}
