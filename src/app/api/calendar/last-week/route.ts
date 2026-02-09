import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getValidAccessToken } from "@/lib/googleToken";

const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DEFAULT_DAYS = 30;
const MAX_RESULTS = 250;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

function parseDays(input: number): number {
  if (!Number.isFinite(input) || input < 1) return DEFAULT_DAYS;
  return Math.min(365, Math.floor(input));
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getValidAccessToken(userEmail);
    const url = new URL(request.url);
    const days = parseDays(Number(url.searchParams.get("days")));
    const now = new Date();
    const timeMax = now.toISOString();
    const timeMin = new Date(now.getTime() - days * MS_IN_DAY).toISOString();

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(MAX_RESULTS),
    });

    const res = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: "Failed to fetch Google Calendar events", details: errorText },
        { status: res.status }
      );
    }

    const json = (await res.json()) as { items?: unknown[] };
    return NextResponse.json({ events: json.items ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "No stored Google tokens for user") {
      return NextResponse.json(
        { error: "No Google tokens for user. Re-authenticate to grant calendar access." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch Google Calendar events", details: message },
      { status: 500 }
    );
  }
}
