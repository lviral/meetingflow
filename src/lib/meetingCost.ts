import { calculateMeetingCost as calculateCoreMeetingCost } from "@/core/calculateMeetingCost";

type CalendarEvent = {
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{ email?: string }>;
};

// Backwards-compatible wrapper around pure core logic.
export function calculateMeetingCost(
  event: CalendarEvent,
  roleByPersonEmail?: Map<string, string>
) {
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;

  if (!start || !end) {
    return null;
  }

  return calculateCoreMeetingCost(
    {
      start,
      end,
      attendees: (event.attendees ?? [])
        .map((attendee) => (typeof attendee.email === "string" ? attendee.email : ""))
        .filter((email) => email.trim().length > 0),
    },
    roleByPersonEmail
  );
}

export { calculateCoreMeetingCost };
