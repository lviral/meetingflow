import { getHourlyRate } from "@/lib/salaryTable";

type CalendarEvent = {
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{ email?: string }>;
};

export function calculateMeetingCost(
  event: CalendarEvent,
  roleByPersonEmail?: Map<string, string>
) {
  const startDateTime = event.start?.dateTime;
  const endDateTime = event.end?.dateTime;

  if (!startDateTime || !endDateTime) {
    return null;
  }

  const startMs = new Date(startDateTime).getTime();
  const endMs = new Date(endDateTime).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return null;
  }

  const durationHours = (endMs - startMs) / (1000 * 60 * 60);
  const attendeeEmails = (event.attendees ?? [])
    .map((attendee) => (typeof attendee.email === "string" ? attendee.email.trim() : ""))
    .filter((email) => email.length > 0);

  const billedAttendees = attendeeEmails.length > 0 ? attendeeEmails : [""];
  const unassignedEmails = new Set<string>();
  let totalHourlyRate = 0;

  for (const email of billedAttendees) {
    const mappedRole = email ? roleByPersonEmail?.get(email) : undefined;
    if (email && !mappedRole) {
      unassignedEmails.add(email);
    }
    totalHourlyRate += getHourlyRate(mappedRole ?? "engineer");
  }

  const attendees = billedAttendees.length;
  const peopleHours = durationHours * attendees;
  const costUSD = Number((durationHours * totalHourlyRate).toFixed(2));

  return {
    durationHours,
    peopleHours,
    attendees,
    costUSD,
    unassignedEmails,
  };
}
