import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

type AgentAuthResult = { ok: true } | { ok: false; response: NextResponse };

function parseApiKeyFromAuthorizationHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const trimmed = authHeader.trim();
  const withoutAuthPrefix = trimmed.replace(/^authorization\s*:\s*/i, "");
  const match = withoutAuthPrefix.match(/^api-key\s*:?\s*(.+)$/i);
  if (!match) return null;

  const rawKey = match[1]?.trim();
  if (!rawKey) return null;

  // Accept accidental wrapping quotes from CLI tools/config UIs.
  const unquoted = rawKey.replace(/^["']|["']$/g, "").trim();
  return unquoted || null;
}

function safeDevLog(authHeader: string | null, hasEnvKey: boolean) {
  if (process.env.NODE_ENV === "production") return;

  const prefix = (authHeader ?? "").slice(0, 10);
  console.log("[agentAuth] authPrefix=%s envKeySet=%s", prefix, hasEnvKey);
}

export function requireAgentApiKey(request: Request): AgentAuthResult {
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.AGENT_API_KEY?.trim();
  safeDevLog(authHeader, Boolean(expectedKey));

  const providedKey = parseApiKeyFromAuthorizationHeader(authHeader);
  if (!expectedKey || !providedKey) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const expectedBuffer = Buffer.from(expectedKey);
  const providedBuffer = Buffer.from(providedKey.trim());
  if (expectedBuffer.length !== providedBuffer.length) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true };
}
