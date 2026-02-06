import { getHourlyRate } from "@/lib/salaryTable";

type CalendarEvent = {
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{ email?: string }>;
};

export function calculateMeetingCost(event: CalendarEvent) {
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
  const attendees = event.attendees?.length ?? 1;
  const costUSD = Number(
    (durationHours * attendees * getHourlyRate("engineer")).toFixed(2)
  );

  return {
    durationHours,
    attendees,
    costUSD,
  };
}
