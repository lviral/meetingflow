// Pure core insights generation from an already computed WeeklySummary.
import type { WeeklySummary } from "@/core/types";

type InsightMetrics = Record<string, number | string>;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function avg(total: number, count: number): number {
  if (count <= 0) return 0;
  return round2(total / count);
}

export function buildProInsights(summary: WeeklySummary): {
  insightText: string;
  bullets: string[];
  metrics: InsightMetrics;
} {
  const avgCostPerMeeting = avg(summary.totalCostUSD, summary.totalMeetings);
  const avgPeopleHoursPerMeeting = avg(summary.totalPeopleHours, summary.totalMeetings);
  const costPerPeopleHour = avg(summary.totalCostUSD, summary.totalPeopleHours);
  const workDaysLost = round2(summary.totalPeopleHours / 8);
  const peakDay = summary.spendByDay.reduce(
    (max, day) => (day.costUSD > max.costUSD ? day : max),
    { date: "", costUSD: 0, peopleHours: 0, meetings: 0 }
  );

  const metrics: InsightMetrics = {
    avgCostPerMeeting,
    avgPeopleHoursPerMeeting,
    costPerPeopleHour,
    workDaysLost,
    peakDayDate: peakDay.date,
    peakDayCostUSD: round2(peakDay.costUSD),
    peakDayMeetings: peakDay.meetings,
  };

  if (summary.totalMeetings === 0) {
    return {
      insightText: `In the last ${summary.days} days, no meetings were recorded, so total meeting cost remained $0 across 0 meetings and 0 people-hours. Keep role assignments current so new activity is measured accurately.`,
      bullets: [
        "No meetings detected in the selected window; no meeting-spend action is required this week.",
        "Keep calendars and role mappings current to ensure future reporting remains accurate.",
      ],
      metrics,
    };
  }

  const bullets: string[] = [];

  if (peakDay.date) {
    bullets.push(
      `Peak spend was $${round2(peakDay.costUSD)} on ${peakDay.date} (${peakDay.meetings} meetings). Review what drove that day and replicate high-value patterns while cutting low-value blocks.`
    );
  }

  if (summary.totalMeetings > 0) {
    bullets.push(
      `Average meeting cost is ~$${avgCostPerMeeting}. Cutting one similar low-value meeting saves about $${avgCostPerMeeting}. Cancel or shorten the next recurring meeting without a clear outcome.`
    );
  }

  if (summary.totalPeopleHours > 0) {
    bullets.push(
      `Meetings consumed ${summary.totalPeopleHours} people-hours (~${workDaysLost} workdays at 8h/day). Protect focus time with a recurring no-meeting block each week.`
    );
  }

  if (summary.unassignedPeopleCount > 0) {
    bullets.push(
      `${summary.unassignedPeopleCount} people have no assigned role, so cost estimates may be understated. Assign missing roles to tighten spend accuracy.`
    );
  }

  if (summary.totalPeopleHours > 0) {
    bullets.push(
      `Cost is ~$${costPerPeopleHour} per people-hour. Reduce this by defaulting to 25-minute meetings and capping attendees to required decision-makers.`
    );
  }

  const trimmedBullets = bullets.slice(0, 5);

  return {
    insightText: `In the last ${summary.days} days, meetings cost $${round2(summary.totalCostUSD)} across ${summary.totalMeetings} meetings and ${summary.totalPeopleHours} people-hours. Spend concentration and per-meeting cost indicate where time is being converted into avoidable expense. Prioritize reducing low-value recurring meetings and tightening attendance in the next cycle.`,
    bullets: trimmedBullets,
    metrics,
  };
}
