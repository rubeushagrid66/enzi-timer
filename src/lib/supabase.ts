import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Same Supabase project as enzi-ws (project wjmaaagrlmwcesmovfwr).
// The timer uses ONE table there: enzi_timer_activities — see the
// table comment in Supabase. Do not delete or rename that table;
// the workshop code does not use it, and the timer does not use
// any workshop table.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Force `cache: "no-store"` on every request, as in enzi-ws —
// Next.js Data Cache must never serve a stale activity list.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input: unknown, init?: RequestInit) =>
          fetch(input as RequestInfo, { ...init, cache: "no-store" }),
      },
    })
  : null;
