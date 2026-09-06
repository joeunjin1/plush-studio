import { createClient } from "@supabase/supabase-js";

function projectUrl() {
  return (import.meta.env.VITE_SUPABASE_URL ?? "")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "");
}

const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = projectUrl() && publishableKey
  ? createClient(projectUrl(), publishableKey)
  : null;

export const supabaseReady = Boolean(supabase);
