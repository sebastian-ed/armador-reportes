import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Pegá acá tus credenciales de Supabase.
// Formato correcto:
//   url: 'https://tu-proyecto.supabase.co'
//   anonKey: 'eyJ...'
const CONFIG = {
  url: 'https://jwgrwnogsgdqqmfpqhwj.supabase.co',
  anonKey: 'sb_publishable_nWpY61fucjXBFA8LI8rM0w_y5uc0KCQ',
};

function clean(value) {
  return String(value || '').trim();
}

function isPlaceholder(value) {
  return !value || value.includes('REEMPLAZAR_CON_') || value.includes('TU-PROYECTO') || value.includes('TU_ANON_KEY');
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function createStubClient(message) {
  const fail = async () => ({ data: null, error: new Error(message) });
  const failSession = async () => ({ data: { session: null }, error: new Error(message) });
  return {
    __isStub: true,
    auth: {
      getSession: failSession,
      signInWithPassword: fail,
      signUp: fail,
      signOut: fail,
      updateUser: fail,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: fail,
          order: fail,
        }),
        order: fail,
        single: fail,
      }),
      insert: fail,
      upsert: () => ({ select: () => ({ single: fail }) }),
      update: () => ({ eq: fail }),
      delete: () => ({ eq: fail }),
    }),
    storage: {
      from: () => ({
        upload: fail,
        remove: fail,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };
}

const resolvedUrl = clean(globalThis.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || CONFIG.url);
const resolvedAnonKey = clean(globalThis.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || CONFIG.anonKey);

export let supabaseConfigError = '';
export let isSupabaseConfigured = false;
export let supabase;

if (isPlaceholder(resolvedUrl) || isPlaceholder(resolvedAnonKey)) {
  supabaseConfigError = 'Configurá SUPABASE_URL y SUPABASE_ANON_KEY en supabase-config.js antes de usar la app.';
  console.error(supabaseConfigError);
  supabase = createStubClient(supabaseConfigError);
} else if (!isValidHttpUrl(resolvedUrl)) {
  supabaseConfigError = `La SUPABASE_URL no es válida: "${resolvedUrl}". Debe empezar con http:// o https://.`;
  console.error(supabaseConfigError);
  supabase = createStubClient(supabaseConfigError);
} else {
  isSupabaseConfigured = true;
  supabase = createClient(resolvedUrl, resolvedAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
