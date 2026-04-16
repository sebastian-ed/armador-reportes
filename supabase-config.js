import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'REEMPLAZAR_CON_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'REEMPLAZAR_CON_SUPABASE_ANON_KEY';

if (SUPABASE_URL.includes('REEMPLAZAR') || SUPABASE_ANON_KEY.includes('REEMPLAZAR')) {
  console.warn('Configurá SUPABASE_URL y SUPABASE_ANON_KEY en supabase-config.js antes de usar la app.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
