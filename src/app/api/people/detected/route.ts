import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getValidAccessToken } from "@/lib/googleToken";

const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DEFAULT_DAYS = 30;
const MAX_RESULTS = 250;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

type GoogleCalendarEvent = {
  attendees?: Array<{ email?: string }>;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getValidAccessToken(userEmail);
    const url = new URL(request.url);
    const daysParam = Number(url.searchParams.get("days"));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.floor(daysParam) : DEFAULT_DAYS;

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
    const emails = new Set<string>();

    for (const event of json.items ?? []) {
      for (const attendee of event.attendees ?? []) {
        const email = attendee.email?.trim();
        if (email) {
          emails.add(email);
        }
      }
    }

    return NextResponse.json({ emails: Array.from(emails) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to detect attendee emails", details: message },
      { status: 500 }
    );
  }
}
