import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://jwgrwnogsgdqqmfpqhwj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nWpY61fucjXBFA8LI8rM0w_y5uc0KCQ';

if (SUPABASE_URL.includes('https://jwgrwnogsgdqqmfpqhwj.supabase.co') || SUPABASE_ANON_KEY.includes('sb_publishable_nWpY61fucjXBFA8LI8rM0w_y5uc0KCQ')) {
  console.warn('Configurá SUPABASE_URL y SUPABASE_ANON_KEY en supabase-config.js antes de usar la app.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
