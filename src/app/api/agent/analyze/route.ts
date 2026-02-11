import { NextResponse } from "next/server";
import { buildProInsights } from "@/core/buildProInsights";
import { buildWeeklySummaryFromEvents } from "@/core/buildWeeklySummary";
import type { CalendarEvent } from "@/core/types";
import { requireAgentApiKey } from "@/lib/agentAuth";

/**
 * Agent analyze endpoint (API key required)
 * Env: AGENT_API_KEY
 *
 * Response includes: requestId, eventCount, summary, insights
 *
 * curl -X POST http://localhost:3000/api/agent/analyze \
 *   -H "Authorization: Api-Key $AGENT_API_KEY" \
 *   -H "Content-Type: application/json" \
 *   -d '{"days":30,"events":[{"start":"2026-02-01T10:00:00Z","end":"2026-02-01T11:00:00Z","attendees":["a@acme.com","b@acme.com"]}]}'
 */

type AnalyzeBody = {
  events?: unknown;
  roleByPersonEmail?: unknown;
  days?: unknown;
};

function normalizeEvents(input: unknown): CalendarEvent[] | null {
  if (!Array.isArray(input)) return null;

  const normalized: CalendarEvent[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;

    const maybeEvent = item as Record<string, unknown>;
    const start = maybeEvent.start;
    const end = maybeEvent.end;
    const attendees = maybeEvent.attendees;

    if (typeof start !== "string" || typeof end !== "string" || !Array.isArray(attendees)) {
      return null;
    }

    const normalizedAttendees = attendees.filter(
      (attendee): attendee is string => typeof attendee === "string"
    );

    if (normalizedAttendees.length !== attendees.length) return null;

    normalized.push({
      start,
      end,
      attendees: normalizedAttendees,
    });
  }

  return normalized;
}

function normalizeRoleMap(input: unknown): Map<string, string> | undefined {
  if (input == null) return undefined;
  if (typeof input !== "object" || Array.isArray(input)) return undefined;

  const pairs = Object.entries(input as Record<string, unknown>).filter(
    ([email, role]) => typeof email === "string" && typeof role === "string"
  ) as Array<[string, string]>;

  return new Map(pairs);
}

function normalizeDays(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input)) return undefined;
  return Math.floor(input);
}

function buildRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function POST(request: Request) {
  const auth = requireAgentApiKey(request);
  if (!auth.ok) return auth.response;

  let body: AnalyzeBody;

  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json(
      { error: "Bad Request", details: "Body must be valid JSON" },
      { status: 400 }
    );
  }

  const events = normalizeEvents(body.events);
  if (!events) {
    return NextResponse.json(
      {
        error: "Bad Request",
        details: "events must be an array of { start: string, end: string, attendees: string[] }",
      },
      { status: 400 }
    );
  }

  const roleByPersonEmail = normalizeRoleMap(body.roleByPersonEmail);
  if (body.roleByPersonEmail != null && !roleByPersonEmail) {
    return NextResponse.json(
      { error: "Bad Request", details: "roleByPersonEmail must be a Record<string, string>" },
      { status: 400 }
    );
  }

  const days = normalizeDays(body.days);

  const summary = buildWeeklySummaryFromEvents({
    events,
    roleByPersonEmail,
    days,
  });
  const insights = buildProInsights(summary);

  return NextResponse.json({
    requestId: buildRequestId(),
    eventCount: events.length,
    summary,
    insights,
  });
}
