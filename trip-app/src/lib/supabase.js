import { createClient } from '@supabase/supabase-js';

// Configured → shared mode (login, 旅伴共用, realtime). Not configured → this
// device only (localStorage), which keeps the app usable for a quick try-out.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;
export const sharedMode = !!supabase;
