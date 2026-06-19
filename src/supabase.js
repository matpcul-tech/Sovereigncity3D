import { createClient } from '@supabase/supabase-js';

/* =========================================================
   SUPABASE CLIENT — Founders Commons shared town data
   Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at
   build time (e.g. via a .env file) to enable the shared
   town features. Without them the game still runs fully in
   solo/local-save mode.
   ========================================================= */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client = null;
export function getSupabase() {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
