import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CONFIG = {
  url: 'REEMPLAZAR_CON_SUPABASE_URL',
  anonKey: 'REEMPLAZAR_CON_SUPABASE_ANON_KEY',
};

function clean(value) {
  return String(value || '').trim();
}

function isPlaceholder(value) {
  return !value || value.includes('REEMPLAZAR_CON_');
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const resolvedUrl = clean(globalThis.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || CONFIG.url);
const resolvedAnonKey = clean(globalThis.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || CONFIG.anonKey);

export let supabase = null;
export let supabaseConfigError = '';

if (isPlaceholder(resolvedUrl) || isPlaceholder(resolvedAnonKey)) {
  supabaseConfigError = 'Configurá SUPABASE_URL y SUPABASE_ANON_KEY en supabase-config.js antes de usar la app.';
  console.error(supabaseConfigError);
} else if (!isValidHttpUrl(resolvedUrl)) {
  supabaseConfigError = `La SUPABASE_URL no es válida: "${resolvedUrl}". Debe empezar con http:// o https://.`;
  console.error(supabaseConfigError);
} else {
  supabase = createClient(resolvedUrl, resolvedAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
