-- Sovereign City — Classroom Edition DB patch
-- Run AFTER supabase-migration.sql in the Supabase SQL Editor.

-- Teacher override: daily challenge text per town
ALTER TABLE towns ADD COLUMN IF NOT EXISTS daily_challenge text;

-- Enable realtime on saves so facilitator dashboard gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE saves;
