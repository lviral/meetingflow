import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getValidAccessToken } from "@/lib/googleToken";

const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const MAX_RESULTS = 250;
const MS_IN_MINUTE = 60_000;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

type GoogleCalendarEvent = {
  id?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string }>;
  recurringEventId?: string;
  recurrence?: string[];
};

function toIsoOrNull(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeEvent(event: GoogleCalendarEvent) {
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;
  const startIso = toIsoOrNull(startRaw);
  const endIso = toIsoOrNull(endRaw);

  let durationMinutes = 0;
  if (startIso && endIso) {
    durationMinutes = Math.max(
      0,
      Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / MS_IN_MINUTE)
    );
  }

  return {
    eventId: event.id ?? "",
    start: startIso ?? "",
    end: endIso ?? "",
    durationMinutes,
    attendeesCount: event.attendees?.length ?? 0,
    isRecurring: Boolean(event.recurringEventId || (event.recurrence && event.recurrence.length > 0)),
  };
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
    const daysParam = url.searchParams.get("days");
    let days = 7;

    if (daysParam) {
      const parsed = Number(daysParam);
      if (Number.isFinite(parsed)) {
        days = Math.max(1, Math.min(60, Math.floor(parsed)));
      }
    }

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

    const json = (await res.json()) as { items?: GoogleCalendarEvent[] };
    const items = json.items ?? [];
    const events = items.map(normalizeEvent);

    return NextResponse.json({ events });
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
