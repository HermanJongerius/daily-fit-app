-- DailyFit — databankstructuur
-- Wordt uitgevoerd door src/migrate.js. Veilig om opnieuw te draaien (IF NOT EXISTS overal).

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin', 'senior')),
  display_name   TEXT NOT NULL,
  phone          TEXT,             -- alleen voor senior-accounts (genormaliseerd, digits-only)
  phone_display  TEXT,             -- origineel ingevoerde nummer, voor weergave/contact
  password_hash  TEXT,             -- alleen voor admin-accounts (bcrypt)
  paid_until     DATE,             -- alleen relevant voor senior-accounts
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT senior_has_phone CHECK (role <> 'senior' OR phone IS NOT NULL),
  CONSTRAINT admin_has_password CHECK (role <> 'admin' OR password_hash IS NOT NULL)
);

-- Per dag staan er (sinds versie 1.11.0) 4 losse video's gepland i.p.v. 1 — een gewricht
-- moet vanuit meerdere kanten bewogen worden, en dat vraagt om 4 losse oefeningen/video's
-- (bijv. "Nek — rotatie links/rechts", "Nek — voor/achter buigen", ...). "slot" is het
-- volgnummer (1 t/m 4) waarin een deelnemer ze doorloopt. Voor een nieuwe database wordt de
-- tabel meteen zo aangemaakt; bestaande databases (met de oude structuur van vóór 1.11.0,
-- één rij per datum) worden hieronder in het DO-blok bijgewerkt.
CREATE TABLE IF NOT EXISTS schedule (
  date           DATE NOT NULL,
  slot           INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 4),
  joint          TEXT NOT NULL,       -- afgeleid van de weekdag, ter info/weergave opgeslagen
  video_uid      TEXT,                -- Cloudflare Stream video-ID; NULL zolang er geen video is
  video_label    TEXT,                -- mens-leesbare naam/omschrijving
  duration_sec   INTEGER,
  video_status   TEXT NOT NULL DEFAULT 'none' CHECK (video_status IN ('none', 'processing', 'ready')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, slot)
);

-- Migratie voor bestaande databases die de oude structuur nog hebben (schedule met alleen
-- "date" als primary key, van vóór versie 1.11.0): voeg "slot" toe (bestaande rijen worden
-- daarmee slot 1), en zet de primary key om naar (date, slot). Veilig om herhaald te draaien
-- — als de kolom al bestaat (nieuwe database, of migratie al eerder gedraaid) gebeurt er niets.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'schedule' AND column_name = 'slot'
     ) THEN
    ALTER TABLE schedule ADD COLUMN slot INTEGER NOT NULL DEFAULT 1 CHECK (slot BETWEEN 1 AND 4);
    ALTER TABLE schedule DROP CONSTRAINT schedule_pkey;
    ALTER TABLE schedule ADD PRIMARY KEY (date, slot);
    ALTER TABLE schedule ALTER COLUMN slot DROP DEFAULT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS completions (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS sessions (
  token          TEXT PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Houdt bij welke van de 4 video's van een dag een deelnemer al heeft afgerond (sinds
-- versie 1.11.0). Pas zodra alle 4 slots hier een rij hebben, wordt er (zie app.js,
-- /video/complete) ook een rij in "completions" hierboven weggeschreven — die tabel en alle
-- bestaande logica die daarop steunt (de 7-daagse cyclus, dagbolletjes, trainingsstatistiek,
-- beloningsvideo's) blijven daardoor ongewijzigd werken: voor die logica blijft een dag nog
-- steeds gewoon "wel of niet gedaan", ongeacht dat het er nu 4 video's onder zijn.
CREATE TABLE IF NOT EXISTS video_completions (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  slot           INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 4),
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date, slot)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_user ON completions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_completions_user_date ON video_completions(user_id, date);

-- Informatie-video's die een deelnemer ontgrendelt door een hele trainingsweek (7 van de 7
-- dagen) af te maken — zie /voortgang in app.js. Op volgorde: de eerste volledig afgeronde
-- cyclus ontgrendelt de video met het laagste id, de tweede cyclus de volgende, enzovoort.
CREATE TABLE IF NOT EXISTS reward_videos (
  id             SERIAL PRIMARY KEY,
  label          TEXT,                -- mens-leesbare titel/omschrijving, door de beheerder ingevuld
  video_uid      TEXT,                -- Cloudflare Stream video-ID
  duration_sec   INTEGER,
  video_status   TEXT NOT NULL DEFAULT 'processing' CHECK (video_status IN ('processing', 'ready')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
