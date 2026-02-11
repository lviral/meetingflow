// Pure core weekly summary aggregation from normalized events.
import { calculateMeetingCost } from "@/core/calculateMeetingCost";
import type { CalendarEvent, SpendByDay, WeeklySummary } from "@/core/types";

type BuildWeeklySummaryInput = {
  events: CalendarEvent[];
  roleByPersonEmail?: Map<string, string>;
  days?: number;
};

function normalizeDays(days?: number): number {
  if (!Number.isFinite(days) || !days || days < 1) return 30;
  return Math.floor(days);
}

function toDateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function buildWeeklySummaryFromEvents(input: BuildWeeklySummaryInput): WeeklySummary {
  let totalMeetings = 0;
  let totalPeopleHours = 0;
  let totalCostUSD = 0;
  const unassignedEmails = new Set<string>();
  const spendByDay = new Map<string, SpendByDay>();

  for (const event of input.events) {
    const cost = calculateMeetingCost(event, input.roleByPersonEmail);
    if (!cost) continue;

    totalMeetings += 1;
    totalPeopleHours += cost.peopleHours;
    totalCostUSD += cost.costUSD;
    for (const email of cost.unassignedEmails) {
      unassignedEmails.add(email);
    }

    const dateKey = toDateKey(event.start);
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
    days: normalizeDays(input.days),
    totalMeetings,
    totalPeopleHours: Number(totalPeopleHours.toFixed(2)),
    totalCostUSD: Number(totalCostUSD.toFixed(2)),
    unassignedPeopleCount: unassignedEmails.size,
    spendByDay: Array.from(spendByDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
