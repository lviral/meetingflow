import "server-only";

import { calculateMeetingCost } from "@/lib/meetingCost";
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

export type SpendByDay = {
  date: string;
  costUSD: number;
  peopleHours: number;
  meetings: number;
};

export type WeeklySummary = {
  days: number;
  totalMeetings: number;
  totalPeopleHours: number;
  totalCostUSD: number;
  unassignedPeopleCount: number;
  spendByDay: SpendByDay[];
};

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

function toDateKey(startIso: string): string {
  return startIso.slice(0, 10);
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

  let totalMeetings = 0;
  let totalPeopleHours = 0;
  let totalCostUSD = 0;
  const unassignedEmails = new Set<string>();
  const spendByDay = new Map<string, SpendByDay>();

  for (const event of events) {
    const startIso = toIsoOrNull(event.start?.dateTime ?? event.start?.date);
    const endIso = toIsoOrNull(event.end?.dateTime ?? event.end?.date);
    if (!startIso || !endIso) continue;

    const cost = calculateMeetingCost(
      {
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        attendees: event.attendees,
      },
      roleByPersonEmail
    );

    if (!cost) continue;

    totalMeetings += 1;
    totalPeopleHours += cost.peopleHours;
    totalCostUSD += cost.costUSD;
    for (const email of cost.unassignedEmails) {
      unassignedEmails.add(email);
    }

    const dateKey = toDateKey(startIso);
    const existing = spendByDay.get(dateKey);
    if (existing) {
      existing.costUSD = Number((existing.costUSD + cost.costUSD).toFixed(2));
      existing.peopleHours = Number((existing.peopleHours + cost.peopleHours).toFixed(2));
      existing.meetings += 1;
    } else {
      spendByDay.set(dateKey, {
        date: dateKey,
        costUSD: Number(cost.costUSD.toFixed(2)),
        peopleHours: Number(cost.peopleHours.toFixed(2)),
        meetings: 1,
      });
    }
  }

  return {
    days,
    totalMeetings,
    totalPeopleHours: Number(totalPeopleHours.toFixed(2)),
    totalCostUSD: Number(totalCostUSD.toFixed(2)),
    unassignedPeopleCount: unassignedEmails.size,
    spendByDay: Array.from(spendByDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
