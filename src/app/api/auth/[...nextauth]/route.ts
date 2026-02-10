import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseServer } from "@/lib/supabaseServer";
import { applyUserEmailScope } from "@/lib/supabaseRls";
import { encryptToken } from "@/lib/tokenCrypto";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

if (!GOOGLE_CLIENT_ID) {
  throw new Error("Missing env GOOGLE_CLIENT_ID");
}

if (!GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing env GOOGLE_CLIENT_SECRET");
}

async function storeTokens(params: {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}) {
  const supabase = supabaseServer();
  await applyUserEmailScope(supabase, params.email);

  const accessTokenEnc = encryptToken(params.accessToken);
  const refreshTokenEnc = encryptToken(params.refreshToken);
  const expiresAtIso = new Date(params.expiresAt * 1000).toISOString();

  const existing = await supabase
    .from("oauth_tokens")
    .select("id")
    .eq("user_id", params.email)
    .eq("provider", "google")
    .maybeSingle();

  if (existing.data?.id) {
    await supabase
      .from("oauth_tokens")
      .update({
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        expires_at: expiresAtIso,
      })
      .eq("id", existing.data.id);
    return;
  }

  await supabase.from("oauth_tokens").insert({
    user_id: params.email,
    provider: "google",
    access_token_enc: accessTokenEnc,
    refresh_token_enc: refreshTokenEnc,
    expires_at: expiresAtIso,
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        token.email = profile.email;

        if (account.access_token && account.refresh_token && account.expires_at) {
          await storeTokens({
            email: profile.email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
          });
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token?.email && session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
