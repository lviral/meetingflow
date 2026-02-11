import { NextResponse } from "next/server";
import { requireAgentApiKey } from "@/lib/agentAuth";

export async function GET(request: Request) {
  const auth = requireAgentApiKey(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true });
}
