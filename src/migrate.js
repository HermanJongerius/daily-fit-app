import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigration() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migratie voltooid — tabellen staan klaar.');
}

// Nog steeds los te draaien met `npm run migrate`, maar server.js roept dit voortaan
// ook automatisch aan bij het opstarten — dus dit is niet meer verplicht.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migratie mislukt:', err);
      process.exit(1);
    });
}
