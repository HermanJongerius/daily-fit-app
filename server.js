import 'dotenv/config';
import app from './src/app.js';
import { runMigration } from './src/migrate.js';
import { seedAdmin } from './src/seed-admin.js';

const port = process.env.PORT || 3000;

// Bij elke opstart: zorg dat de tabellen bestaan en dat het beheerder-account
// klopt met ADMIN_USERNAME/ADMIN_PASSWORD. Zo hoeft er nooit een los commando
// gedraaid te worden — instellen van de omgevingsvariabelen is genoeg.
try {
  await runMigration();
  await seedAdmin();
} catch (err) {
  console.error('Opstarten mislukt tijdens migratie/seed:', err);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`DailyFit draait op http://localhost:${port}`);
});
