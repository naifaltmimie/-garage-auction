import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 20 } },
});

let sessionPromise: Promise<string> | null = null;

/**
 * Every player is an anonymous Supabase user. That gives each device a stable
 * auth.uid() the database can trust — which is what lets the RPCs decide who
 * bid, who may change settings, and whose vote is whose — with no signup step.
 * The session is cached by supabase-js, so a refresh keeps the same identity
 * and join_room() treats the player as a reconnect.
 */
export function ensureSession(): Promise<string> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) return data.session.user.id;

      const { data: signed, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (!signed.user) throw new Error('no anonymous user returned');
      return signed.user.id;
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}
