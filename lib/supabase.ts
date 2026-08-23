import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage:
        typeof window !== "undefined"
          ? window.sessionStorage
          : undefined,

      persistSession: true,

      autoRefreshToken: true,

      detectSessionInUrl: true,
    },
  }
);