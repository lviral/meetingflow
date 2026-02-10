import type { SupabaseClient } from "@supabase/supabase-js";

export async function applyUserEmailScope(supabase: SupabaseClient, userEmail: string) {
  const { error } = await supabase.rpc("set_app_user_email", {
    p_user_email: userEmail,
  });

  if (error) {
    throw new Error("Failed to apply user scope");
  }
}
