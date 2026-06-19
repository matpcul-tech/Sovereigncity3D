-- =====================================================================
-- Sovereign City 3D — Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =====================================================================

-- TOWNS: maps a short human-readable code to a UUID for foreign keys
CREATE TABLE IF NOT EXISTS towns (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code      text NOT NULL UNIQUE,
  name      text,
  created_at timestamptz DEFAULT now()
);

-- PLOTS: Founders Commons buildings, one per plot per town
CREATE TABLE IF NOT EXISTS plots (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  town_id      uuid NOT NULL REFERENCES towns(id),
  plot_index   integer NOT NULL,
  founder_name text NOT NULL,
  biz_name     text NOT NULL,
  industry     text NOT NULL,
  talent       text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(town_id, plot_index)
);

-- FAME: Hall of Fame — global record of every player who reached Sovereignty
CREATE TABLE IF NOT EXISTS fame (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  town_id      uuid REFERENCES towns(id),
  founder_name text NOT NULL,
  biz_name     text NOT NULL,
  industry     text NOT NULL,
  day_achieved integer NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- SAVES: cloud save per (town_code, founder_name)
CREATE TABLE IF NOT EXISTS saves (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  town_code    text NOT NULL,
  founder_name text NOT NULL,
  data         jsonb NOT NULL,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(town_code, founder_name)
);

-- ---- Row Level Security ----
-- The game uses the anon key with no Auth. We allow all anon access.
-- (All data is non-personal: no emails, no passwords, no real names required.)

ALTER TABLE towns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON towns;
CREATE POLICY anon_all ON towns FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE plots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON plots;
CREATE POLICY anon_all ON plots FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE fame ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON fame;
CREATE POLICY anon_all ON fame FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON saves;
CREATE POLICY anon_all ON saves FOR ALL TO anon USING (true) WITH CHECK (true);

-- ---- Realtime ----
-- Enable Realtime publication for plots (for live plot-claim notifications)
-- Run this AFTER enabling Realtime in Dashboard → Database → Replication
ALTER PUBLICATION supabase_realtime ADD TABLE plots;

-- =====================================================================
-- After running this migration:
-- 1. Go to Dashboard → Database → Replication and enable Realtime on "plots"
-- 2. Add GitHub Secrets VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
--    in your repo Settings → Secrets → Actions
-- =====================================================================
