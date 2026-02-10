import { supabaseServer } from "@/lib/supabaseServer";
import { applyUserEmailScope } from "@/lib/supabaseRls";
import { decryptToken, encryptToken } from "@/lib/tokenCrypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = supabaseServer();
  await applyUserEmailScope(supabase, userId);

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("id, access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error || !data) {
    throw new Error("No stored Google tokens for user");
  }

  const expiresAt = new Date(data.expires_at).getTime();
  const now = Date.now();
  if (expiresAt > now + 60_000) {
    return decryptToken(data.access_token_enc);
  }

  const refreshToken = decryptToken(data.refresh_token_enc);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth env vars");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error("Failed to refresh Google access token");
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  const newAccessTokenEnc = encryptToken(json.access_token);
  const newRefreshTokenEnc = encryptToken(json.refresh_token ?? refreshToken);
  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await supabase
    .from("oauth_tokens")
    .update({
      access_token_enc: newAccessTokenEnc,
      refresh_token_enc: newRefreshTokenEnc,
      expires_at: newExpiresAt,
    })
    .eq("id", data.id);

  return json.access_token;
}
