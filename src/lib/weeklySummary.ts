import { calculateMeetingCost } from "@/lib/meetingCost";

type CalendarEvent = {
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{ email?: string }>;
};

export function calculateWeeklySummary(events: CalendarEvent[]) {
  let totalMeetings = 0;
  let totalHours = 0;
  let totalCost = 0;

  for (const event of events) {
    const result = calculateMeetingCost(event);
    if (!result) continue;
    totalMeetings += 1;
    totalHours += result.durationHours;
    totalCost += result.costUSD;
  }

  return {
    totalMeetings,
    totalHours,
    totalCostUSD: Number(totalCost.toFixed(2)),
  };
}
