import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://fnklrqxwyeibfptaxewf.supabase.co';
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON;

export const supabase = createClient(SUPA_URL, SUPA_ANON);
