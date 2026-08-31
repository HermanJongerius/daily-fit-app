// Eenmalig te draaien om de allereerste beheerder-account aan te maken
// (er is bewust geen zelfregistratie, dus zonder dit script kan niemand inloggen).
//
// Gebruik:  ADMIN_USERNAME=beheerder ADMIN_PASSWORD=kies-een-sterk-wachtwoord node src/seed-admin.js
import 'dotenv/config';
import { pool } from './db.js';
import { hashPassword } from './auth.js';

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME || 'Beheerder';

  if (!username || !password) {
    console.error('Zet ADMIN_USERNAME en ADMIN_PASSWORD als omgevingsvariabele en probeer opnieuw.');
    process.exit(1);
  }

  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  const passwordHash = await hashPassword(password);

  if (rows[0]) {
    await pool.query('UPDATE users SET password_hash = $2, display_name = $3 WHERE username = $1', [username, passwordHash, displayName]);
    console.log(`Bestaand account "${username}" bijgewerkt met een nieuw wachtwoord.`);
  } else {
    await pool.query(
      'INSERT INTO users (username, role, display_name, password_hash) VALUES ($1, $2, $3, $4)',
      [username, 'admin', displayName, passwordHash]
    );
    console.log(`Beheerder-account "${username}" aangemaakt.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error('Aanmaken van beheerder mislukt:', err);
  process.exit(1);
});
