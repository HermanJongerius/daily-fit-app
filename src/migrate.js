import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migratie voltooid — tabellen staan klaar.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migratie mislukt:', err);
  process.exit(1);
});
