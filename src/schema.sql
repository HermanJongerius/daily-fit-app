-- Daily Fit — databankstructuur
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

CREATE TABLE IF NOT EXISTS schedule (
  date           DATE PRIMARY KEY,
  joint          TEXT NOT NULL,       -- afgeleid van de weekdag, ter info/weergave opgeslagen
  video_uid      TEXT,                -- Cloudflare Stream video-ID; NULL zolang er geen video is
  video_label    TEXT,                -- mens-leesbare naam/omschrijving
  duration_sec   INTEGER,
  video_status   TEXT NOT NULL DEFAULT 'none' CHECK (video_status IN ('none', 'processing', 'ready')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_user ON completions(user_id);
