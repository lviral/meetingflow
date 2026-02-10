import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserPlan } from "@/lib/plan";
import { getWeeklySummary } from "@/lib/weeklySummary";

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
    const days = Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(maxDays, Math.floor(requestedDays))
      : 30;
    const summary = await getWeeklySummary({ session, days });
    return NextResponse.json({ summary, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "No stored Google tokens for user") {
      return NextResponse.json(
        { error: "No Google tokens for user. Re-authenticate to grant calendar access." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch weekly summary", details: message },
      { status: 500 }
    );
  }
}
