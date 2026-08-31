// Zet het allereerste (of eigen) beheerder-account klaar op basis van ADMIN_USERNAME/ADMIN_PASSWORD.
// (Er is bewust geen zelfregistratie, dus zonder dit zou niemand kunnen inloggen.)
// server.js roept dit automatisch aan bij elke opstart — gewoon de omgevingsvariabelen
// invullen op Railway is dus genoeg, geen los commando meer nodig.
import { fileURLToPath } from 'url';
import { pool } from './db.js';
import { hashPassword } from './auth.js';

export async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME || 'Beheerder';

  if (!username || !password) {
    console.warn('ADMIN_USERNAME/ADMIN_PASSWORD niet ingesteld — er wordt geen beheerder-account aangemaakt of bijgewerkt.');
    return;
  }

  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  const passwordHash = await hashPassword(password);

  if (rows[0]) {
    await pool.query('UPDATE users SET password_hash = $2, display_name = $3 WHERE username = $1', [username, passwordHash, displayName]);
    console.log(`Beheerder-account "${username}" is up-to-date.`);
  } else {
    await pool.query(
      'INSERT INTO users (username, role, display_name, password_hash) VALUES ($1, $2, $3, $4)',
      [username, 'admin', displayName, passwordHash]
    );
    console.log(`Beheerder-account "${username}" aangemaakt.`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  seedAdmin()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Aanmaken van beheerder mislukt:', err);
      process.exit(1);
    });
}
