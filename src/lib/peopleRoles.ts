import { supabaseServer } from "@/lib/supabaseServer";

export async function getPeopleRoleMap(ownerEmail: string): Promise<Map<string, string>> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("people_roles")
    .select("person_email, role")
    .eq("owner_email", ownerEmail);

  if (error) {
    throw new Error("Failed to fetch people roles");
  }

  const roleMap = new Map<string, string>();
  for (const row of data ?? []) {
    if (typeof row.person_email !== "string" || typeof row.role !== "string") continue;
    roleMap.set(row.person_email, row.role);
  }

  return roleMap;
}
