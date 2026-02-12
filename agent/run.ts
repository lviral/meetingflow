import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type SamplePayload = {
  events: Array<{ start: string; end: string; attendees: string[] }>;
  days?: number;
};

type AnalyzeResponse = {
  requestId?: string;
  eventCount?: number;
  summary?: {
    totalMeetings: number;
    totalPeopleHours: number;
    totalCostUSD: number;
    spendByDay: Array<{ date: string; costUSD: number; peopleHours: number; meetings: number }>;
  };
  insights?: {
    bullets?: string[];
  };
};

const apiUrl = process.env.AGENT_API_URL ?? "http://localhost:3000";
const apiKey = process.env.AGENT_API_KEY;

function getPeakDay(summary: NonNullable<AnalyzeResponse["summary"]>): string {
  if (!summary.spendByDay.length) return "N/A";

  const peak = summary.spendByDay.reduce((max, day) => (day.costUSD > max.costUSD ? day : max));
  return `${peak.date} ($${peak.costUSD})`;
}

async function loadSamplePayload(): Promise<SamplePayload> {
  const filePath = resolve(process.cwd(), "agent", "sample-events.json");
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as SamplePayload;
}

function printOutput(data: AnalyzeResponse) {
  const summary = data.summary;
  const bullets = data.insights?.bullets ?? [];

  if (!summary) {
    console.error("Invalid response: missing summary");
    process.exit(1);
  }

  console.log("=== MeetingFlow Agent ===");
  console.log(`Request ID: ${data.requestId ?? "N/A"}`);
  console.log(`Events analyzed: ${data.eventCount ?? "N/A"}`);
  console.log("");
  console.log(`Total Meetings: ${summary.totalMeetings}`);
  console.log(`Total People Hours: ${summary.totalPeopleHours}`);
  console.log(`Total Cost (USD): ${summary.totalCostUSD}`);
  console.log("");
  console.log(`Peak Day: ${getPeakDay(summary)}`);
  console.log("");
  console.log("Top Insights:");

  for (const bullet of bullets.slice(0, 3)) {
    console.log(`- ${bullet}`);
  }

  if (bullets.length === 0) {
    console.log("- No insights returned");
  }
}

async function main() {
  if (!apiKey) {
    console.error("Missing AGENT_API_KEY");
    process.exit(1);
  }

  const payload = await loadSamplePayload();

  const response = await fetch(`${apiUrl}/api/agent/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();

  if (response.status === 401) {
    console.error("Unauthorized: check AGENT_API_KEY");
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`Analyze failed: ${response.status}`);
    console.error(bodyText);
    process.exit(1);
  }

  let parsed: AnalyzeResponse;
  try {
    parsed = JSON.parse(bodyText) as AnalyzeResponse;
  } catch {
    console.error("Analyze failed: invalid JSON response");
    console.error(bodyText);
    process.exit(1);
  }

  printOutput(parsed);
}

main().catch((error) => {
  console.error("Analyze failed:", error);
  process.exit(1);
});
