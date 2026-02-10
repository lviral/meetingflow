import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getWeeklySummary, type WeeklySummary } from "@/lib/weeklySummary";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
const REPORTS_BUCKET = "reports";
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

function parseDays(input: number): number {
  if (!Number.isFinite(input) || input < 1) return 30;
  return Math.min(365, Math.floor(input));
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function ensureReportsBucket() {
  const supabase = supabaseServer();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error("Storage unavailable");
  }

  const exists = (data ?? []).some((bucket) => bucket.name === REPORTS_BUCKET);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(REPORTS_BUCKET, {
    public: false,
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error("Failed to initialize reports bucket");
  }
}

async function uploadAndSign(params: {
  pdfBuffer: Buffer;
  userId: string;
  days: number;
}): Promise<{ path: string; signedUrl: string }> {
  await ensureReportsBucket();
  const supabase = supabaseServer();
  const utcDate = toUtcDateKey(new Date());
  const safeUserId = encodeURIComponent(params.userId);
  const path = `reports/${safeUserId}/weekly/${utcDate}/days-${params.days}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(REPORTS_BUCKET)
    .upload(path, params.pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error("Failed to upload report");
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    throw new Error("Failed to create signed URL");
  }

  return { path, signedUrl: signedData.signedUrl };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

async function buildPdfReport(summary: WeeklySummary) {
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

  page.drawText(`Last ${summary.days} days | Generated ${generatedAt}`, {
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
      value: formatNumber(summary.totalPeopleHours),
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const days = parseDays(Number(url.searchParams.get("days")));
    const download = url.searchParams.get("download") === "1";
    const weeklySummary = await getWeeklySummary({ days, session });
    const pdfBytes = await buildPdfReport(weeklySummary);
    const pdfBuffer = Buffer.from(pdfBytes);
    const userId =
      (typeof session?.user === "object" &&
      session.user &&
      "id" in session.user &&
      typeof session.user.id === "string"
        ? session.user.id
        : null) ?? userEmail;

    let uploadResult: { path: string; signedUrl: string } | null = null;
    try {
      uploadResult = await uploadAndSign({ pdfBuffer, userId, days });
    } catch {
      if (!download) {
        return NextResponse.json(
          { error: "Failed to persist report" },
          { status: 500 }
        );
      }
    }

    if (download) {
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=\"meetingflow-report.pdf\"",
        },
      });
    }

    if (!uploadResult) {
      return NextResponse.json({ error: "Failed to persist report" }, { status: 500 });
    }

    return NextResponse.json({
      summary: weeklySummary,
      signedUrl: uploadResult.signedUrl,
      path: uploadResult.path,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "No stored Google tokens for user") {
      return NextResponse.json(
        { error: "No Google tokens for user. Re-authenticate to grant calendar access." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate PDF report", details: message },
      { status: 500 }
    );
  }
}
