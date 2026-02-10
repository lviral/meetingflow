import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildProInsights } from "@/lib/insights";
import { getUserPlan } from "@/lib/plan";
import { getWeeklySummary } from "@/lib/weeklySummary";

function resolveDays(requestedDays: number, maxDays: number): number {
  if (!Number.isFinite(requestedDays) || requestedDays < 1) return 30;
  return Math.min(maxDays, Math.floor(requestedDays));
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const requestedDays = Number(url.searchParams.get("days"));
    const plan = getUserPlan(userEmail);
    const maxDays = plan === "pro" ? 90 : 30;
    const days = resolveDays(requestedDays, maxDays);
    const summary = await getWeeklySummary({ days, session });

    if (plan === "free") {
      const insightText =
        summary.totalMeetings === 0
          ? `In the last ${summary.days} days, no meetings were recorded, so spend remained $0. Keep tracking enabled to capture future activity.`
          : `In the last ${summary.days} days, meetings cost $${summary.totalCostUSD} across ${summary.totalMeetings} meetings and ${summary.totalPeopleHours} people-hours. Focus first on trimming low-value recurring meetings.`;

      const bullets =
        summary.totalMeetings === 0
          ? ["No meetings detected in this period. Keep your calendar connected for future reporting."]
          : [
              `Average cost per meeting is ~$${Number(
                (summary.totalCostUSD / summary.totalMeetings).toFixed(2)
              )}. Upgrade to Pro for deeper multi-point insights.`,
            ];

      return NextResponse.json({
        plan,
        days: summary.days,
        summary,
        insightText,
        bullets,
        metrics: {},
      });
    }

    const proInsight = buildProInsights(summary);
    return NextResponse.json({
      plan,
      days: summary.days,
      summary,
      insightText: proInsight.insightText,
      bullets: proInsight.bullets,
      metrics: proInsight.metrics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "No stored Google tokens for user") {
      return NextResponse.json(
        { error: "No Google tokens for user. Re-authenticate to grant calendar access." },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: "Failed to generate insight", details: message }, { status: 500 });
  }
}
