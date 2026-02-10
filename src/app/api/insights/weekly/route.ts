import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserPlan } from "@/lib/plan";
import { getWeeklySummary } from "@/lib/weeklySummary";

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function cleanBullets(bullets: unknown): string[] {
  if (!Array.isArray(bullets)) return [];

  return bullets
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 5);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const requestedDays = Number(url.searchParams.get("days"));
    const plan = getUserPlan(userEmail);
    const maxDays = plan === "pro" ? 90 : 30;
    const days = Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(maxDays, Math.floor(requestedDays))
      : 30;
    const summary = await getWeeklySummary({ days, session });

    if (plan === "free") {
      return NextResponse.json({
        insightText: `In the last ${summary.days} days, your meetings cost ${summary.totalCostUSD} USD across ${summary.totalMeetings} meetings.`,
        bullets: ["Upgrade to Pro to unlock deeper multi-point executive insights."],
      });
    }

    const prompt = `You are writing a concise executive insight for meeting spend.
Data for the last ${summary.days} days:
- Total Meeting Spend (USD): ${summary.totalCostUSD}
- Total People-Hours: ${summary.totalPeopleHours}
- Total Meetings: ${summary.totalMeetings}
- Unassigned People: ${summary.unassignedPeopleCount}

Return JSON only with this exact shape:
{
  "insightText": "string (max 3 sentences)",
  "bullets": ["string", "string", "string"]
}

Requirements:
- Use only the provided totals; do not recompute values.
- Tone: concise, executive, slightly punchy, non-offensive
- bullets must be concrete spend equivalents (for example hardware purchases, team lunch, or travel-related equivalents)
- Return 3 to 5 bullets
- No markdown`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You produce factual executive summaries and always return valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meeting_insight",
            strict: true,
            schema: {
              type: "object",
              properties: {
                insightText: { type: "string" },
                bullets: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5,
                },
              },
              required: ["insightText", "bullets"],
              additionalProperties: false,
            },
          },
        },
      }),
      cache: "no-store",
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      return NextResponse.json(
        { error: "Failed to generate insight", details: errorText },
        { status: 500 }
      );
    }

    const aiJson = (await aiRes.json()) as OpenAIChatCompletionResponse;
    const aiContent = aiJson.choices?.[0]?.message?.content;

    if (!aiContent) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    const parsed = JSON.parse(aiContent) as { insightText?: unknown; bullets?: unknown };
    const insightText = typeof parsed.insightText === "string" ? parsed.insightText.trim() : "";
    const bullets = cleanBullets(parsed.bullets);

    if (!insightText || bullets.length < 3 || bullets.length > 5) {
      return NextResponse.json({ error: "Invalid AI response shape" }, { status: 500 });
    }

    return NextResponse.json({ insightText, bullets });
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
