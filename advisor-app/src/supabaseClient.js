import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://fnklrqxwyeibfptaxewf.supabase.co';
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON;

// The client app (index.html) runs on the same origin and the same Supabase project,
// so with the default storage key both apps share one auth slot and each login
// overwrites the other's session. Keep the advisor session separate.
export const supabase = createClient(SUPA_URL, SUPA_ANON, {
  auth: { storageKey: 'sb-advisor-auth-token' }
});
