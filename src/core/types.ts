// Pure core types shared by cost, summary and insights logic.
export type CalendarEvent = {
  start: Date | string;
  end: Date | string;
  attendees: string[];
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

export type MeetingCostResult = {
  durationHours: number;
  peopleHours: number;
  attendees: number;
  attendeeCount: number;
  costUSD: number;
  unassignedEmails: Set<string>;
};
