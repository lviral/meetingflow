export type UserPlan = "free" | "pro";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getUserPlan(email: string): UserPlan {
  const proUsersRaw = process.env.PRO_USERS ?? "";
  if (!proUsersRaw.trim()) return "free";

  const proUsers = new Set(
    proUsersRaw
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter((entry) => entry.length > 0)
  );

  return proUsers.has(normalizeEmail(email)) ? "pro" : "free";
}
