import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Polyfill native WebSocket if absent (e.g. Node < 22) since auth module does not use Realtime
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Supabase client with anon key (limited privileges, for auth password verification)
export const supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Supabase admin client with service role key (full administrative privileges, backend-only)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
