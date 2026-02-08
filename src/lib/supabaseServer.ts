import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");
}

const requiredSupabaseUrl = supabaseUrl;
const requiredSupabaseServiceRoleKey = supabaseServiceRoleKey;

export function supabaseServer() {
  return createClient(requiredSupabaseUrl, requiredSupabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
