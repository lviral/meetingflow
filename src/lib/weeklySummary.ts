import { calculateMeetingCost } from "@/lib/meetingCost";

type CalendarEvent = {
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{ email?: string }>;
};

export function calculateWeeklySummary(
  events: CalendarEvent[],
  roleByPersonEmail?: Map<string, string>
) {
  let totalMeetings = 0;
  let totalHours = 0;
  let totalPeopleHours = 0;
  let totalCost = 0;
  const unassignedEmails = new Set<string>();

  for (const event of events) {
    const result = calculateMeetingCost(event, roleByPersonEmail);
    if (!result) continue;
    totalMeetings += 1;
    totalHours += result.durationHours;
    totalPeopleHours += result.peopleHours;
    totalCost += result.costUSD;
    for (const email of result.unassignedEmails) {
      unassignedEmails.add(email);
    }
  }

  return {
    totalMeetings,
    totalHours: Number(totalHours.toFixed(2)),
    totalPeopleHours: Number(totalPeopleHours.toFixed(2)),
    totalCostUSD: Number(totalCost.toFixed(2)),
    unassignedPeopleCount: unassignedEmails.size,
  };
}
