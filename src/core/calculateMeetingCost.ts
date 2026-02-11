// Pure core cost calculation from normalized event input.
import { getHourlyRate } from "@/lib/salaryTable";
import type { CalendarEvent, MeetingCostResult } from "@/core/types";

export function calculateMeetingCost(
  event: CalendarEvent,
  roleByPersonEmail?: Map<string, string>
): MeetingCostResult | null {
  const startMs = new Date(event.start).getTime();
  const endMs = new Date(event.end).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return null;
  }

  const durationHours = (endMs - startMs) / (1000 * 60 * 60);
  const attendeeEmails = (event.attendees ?? [])
    .map((email) => (typeof email === "string" ? email.trim() : ""))
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

  const attendeeCount = billedAttendees.length;
  const peopleHours = durationHours * attendeeCount;
  const costUSD = Number((durationHours * totalHourlyRate).toFixed(2));

  return {
    durationHours,
    peopleHours,
    attendees: attendeeCount,
    attendeeCount,
    costUSD,
    unassignedEmails,
  };
}
