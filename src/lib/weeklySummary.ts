import "server-only";

import { buildWeeklySummaryFromEvents } from "@/core/buildWeeklySummary";
import type { CalendarEvent, WeeklySummary } from "@/core/types";
import { getValidAccessToken } from "@/lib/googleToken";
import { getPeopleRoleMap } from "@/lib/peopleRoles";

const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DEFAULT_DAYS = 30;
const MAX_RESULTS = 250;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

type GoogleCalendarEvent = {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string }>;
};

export type { SpendByDay, WeeklySummary } from "@/core/types";

type SessionLike = {
  user?: {
    email?: string | null;
  };
} | null;

function parseDays(input: number): number {
  if (!Number.isFinite(input) || input < 1) return DEFAULT_DAYS;
  return Math.min(365, Math.floor(input));
}

function toIsoOrNull(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function getWeeklySummary(args: {
  days: number;
  session: any;
}): Promise<WeeklySummary> {
  const session = args.session as SessionLike;
  const userEmail = session?.user?.email;

  if (!userEmail || typeof userEmail !== "string") {
    throw new Error("Unauthorized");
  }

  const days = parseDays(args.days);
  const accessToken = await getValidAccessToken(userEmail);
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
    throw new Error(`Failed to fetch Google Calendar events: ${errorText}`);
  }

  const json = (await res.json()) as { items?: GoogleCalendarEvent[] };
  const events = json.items ?? [];
  const roleByPersonEmail = await getPeopleRoleMap(userEmail);
  const normalizedEvents: CalendarEvent[] = [];

  for (const event of events) {
    const startIso = toIsoOrNull(event.start?.dateTime ?? event.start?.date);
    const endIso = toIsoOrNull(event.end?.dateTime ?? event.end?.date);
    if (!startIso || !endIso) continue;

    normalizedEvents.push({
      start: startIso,
      end: endIso,
      attendees: (event.attendees ?? [])
        .map((attendee) => (typeof attendee.email === "string" ? attendee.email.trim() : ""))
        .filter((email) => email.length > 0),
    });
  }

  return buildWeeklySummaryFromEvents({
    events: normalizedEvents,
    roleByPersonEmail,
    days,
  });
}
