import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getValidAccessToken } from "@/lib/googleToken";
import { calculateWeeklySummary } from "@/lib/weeklySummary";

export const runtime = "nodejs";

const GOOGLE_CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const DAYS = 30;

type GoogleCalendarEvent = {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value
  );
}

async function buildPdfReport(summary: {
  totalMeetings: number;
  totalHours: number;
  totalCostUSD: number;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const cardPadding = 28;
  const cardWidth = width - margin * 2;
  const cardHeight = 360;
  const cardX = margin;
  const cardY = height - margin - cardHeight;

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.89, 0.91, 0.94),
    borderWidth: 1,
  });

  const titleY = cardY + cardHeight - cardPadding;
  page.drawText("Meeting Spend Report", {
    x: cardX + cardPadding,
    y: titleY,
    size: 20,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });

  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  page.drawText(`Last ${DAYS} days · Generated ${generatedAt}`, {
    x: cardX + cardPadding,
    y: titleY - 22,
    size: 11,
    font: fontRegular,
    color: rgb(0.39, 0.45, 0.55),
  });

  const metricY = titleY - 70;
  const metricGap = 14;
  const metricWidth = (cardWidth - cardPadding * 2 - metricGap * 2) / 3;
  const metricHeight = 120;
  const metricX = cardX + cardPadding;

  const metrics = [
    {
      label: "Total Spend (USD)",
      value: formatCurrency(summary.totalCostUSD),
    },
    {
      label: "Total People-Hours",
      value: formatNumber(summary.totalHours),
    },
    {
      label: "Total Meetings",
      value: formatNumber(summary.totalMeetings),
    },
  ];

  metrics.forEach((metric, index) => {
    const x = metricX + index * (metricWidth + metricGap);
    const y = metricY - metricHeight;

    page.drawRectangle({
      x,
      y,
      width: metricWidth,
      height: metricHeight,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
    });

    page.drawText(metric.label.toUpperCase(), {
      x: x + 16,
      y: y + metricHeight - 28,
      size: 9,
      font: fontRegular,
      color: rgb(0.39, 0.45, 0.55),
    });

    page.drawText(metric.value, {
      x: x + 16,
      y: y + metricHeight - 60,
      size: 16,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });
  });

  page.drawText("MeetingFlow MVP", {
    x: cardX + cardPadding,
    y: cardY + 16,
    size: 10,
    font: fontRegular,
    color: rgb(0.58, 0.64, 0.72),
  });

  return pdfDoc.save();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      maxResults: "250",
    });

    const res = await fetch(
      `${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: "Failed to fetch Google Calendar events", details: errorText },
        { status: res.status }
      );
    }

    const json = (await res.json()) as { items?: GoogleCalendarEvent[] };
    const items = json.items ?? [];
    const weeklySummary = calculateWeeklySummary(items);
    const pdfBytes = await buildPdfReport(weeklySummary);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"meetingflow-report.pdf\"",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate PDF report", details: message },
      { status: 500 }
    );
  }
}
