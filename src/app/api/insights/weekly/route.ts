import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getValidAccessToken } from "@/lib/googleToken";
import { calculateWeeklySummary } from "@/lib/weeklySummary";

const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DAYS = 30;
const MAX_RESULTS = 250;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

type GoogleCalendarEvent = {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string }>;
};

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
    .slice(0, 3);
}

export async function GET() {
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
    const accessToken = await getValidAccessToken(userEmail);

    const now = new Date();
    const timeMax = now.toISOString();
    const timeMin = new Date(now.getTime() - DAYS * MS_IN_DAY).toISOString();

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(MAX_RESULTS),
    });

    const calendarRes = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!calendarRes.ok) {
      const errorText = await calendarRes.text();
      return NextResponse.json(
        { error: "Failed to fetch Google Calendar events", details: errorText },
        { status: calendarRes.status }
      );
    }

    const calendarJson = (await calendarRes.json()) as { items?: GoogleCalendarEvent[] };
    const items = calendarJson.items ?? [];
    const summary = calculateWeeklySummary(items);

    const prompt = `You are writing a concise executive insight for meeting spend.\nData for the last 30 days:\n- Total Meeting Spend (USD): ${summary.totalCostUSD}\n- Total People-Hours: ${summary.totalHours}\n- Total Meetings: ${summary.totalMeetings}\n\nReturn JSON only with this exact shape:\n{\n  "insightText": "string (max 3 sentences)",\n  "bullets": ["string", "string", "string"]\n}\n\nRequirements:\n- Tone: concise, executive, slightly punchy, non-offensive\n- bullets must be concrete spend equivalents (for example hardware purchases, team lunch, or travel-related equivalents)\n- Exactly 3 bullets\n- No markdown`;

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
                  maxItems: 3,
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

    if (!insightText || bullets.length !== 3) {
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
