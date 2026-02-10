"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  LinearScale,
  Tooltip,
  type TooltipItem,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import SignOutButton from "@/app/dashboard/SignOutButton";
import type { UserPlan } from "@/lib/plan";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

type WeeklySummary = {
  days: number;
  totalMeetings: number;
  totalPeopleHours: number;
  totalCostUSD: number;
  unassignedPeopleCount: number;
  spendByDay: Array<{
    date: string;
    costUSD: number;
    peopleHours: number;
    meetings: number;
  }>;
};

type SummaryResponse = {
  summary: WeeklySummary;
  plan: UserPlan;
};

type InsightResponse = {
  insightText: string;
  bullets: string[];
};

const DAYS = 30;

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [plan, setPlan] = useState<UserPlan>("free");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copyingShareLink, setCopyingShareLink] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [summaryRes, insightRes] = await Promise.all([
          fetch(`/api/summary/weekly?days=${DAYS}`, {
            cache: "no-store",
          }),
          fetch(`/api/insights/weekly?days=${DAYS}`, {
            cache: "no-store",
          }),
        ]);

        if (summaryRes.ok) {
          const summaryJson = (await summaryRes.json()) as SummaryResponse;
          if (isMounted) {
            setSummary(summaryJson.summary);
            setPlan(summaryJson.plan);
          }
        } else if (isMounted) {
          setSummaryError("Failed to load meeting summary");
        }

        if (insightRes.ok) {
          const insightJson = (await insightRes.json()) as InsightResponse;
          if (isMounted) {
            setInsight(insightJson);
          }
        } else if (isMounted) {
          setInsightError("Failed to load executive insight");
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setSummaryError((prev) => prev ?? message);
          setInsightError((prev) => prev ?? message);
        }
      } finally {
        if (isMounted) {
          setSummaryLoading(false);
          setInsightLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }),
    []
  );

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }),
    []
  );

  const chartData = useMemo(() => {
    const labels: string[] = [];
    const buckets = new Map<string, number>();
    const today = new Date();

    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = toDateKey(date);
      buckets.set(key, 0);
      labels.push(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }

    for (const bucket of summary?.spendByDay ?? []) {
      const key = bucket.date;
      if (!buckets.has(key)) continue;
      buckets.set(key, Number(((buckets.get(key) ?? 0) + bucket.costUSD).toFixed(2)));
    }

    const data = Array.from(buckets.values()).map((value) => Number(value.toFixed(2)));

    return {
      labels,
      datasets: [
        {
          label: "Daily spend",
          data,
          backgroundColor: "rgba(56, 189, 248, 0.65)",
          borderRadius: 6,
          maxBarThickness: 28,
        },
      ],
    };
  }, [summary]);

  const chartOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"bar">) =>
              currencyFormatter.format(typeof ctx.raw === "number" ? ctx.raw : 0),
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#cbd5f5" },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#cbd5f5" },
          grid: { color: "rgba(148, 163, 184, 0.2)" },
        },
      },
    }),
    [currencyFormatter]
  );

  const costDisplay = summary
    ? currencyFormatter.format(summary.totalCostUSD)
    : summaryLoading
    ? "Loading…"
    : "—";

  const hoursDisplay = summary
    ? numberFormatter.format(summary.totalPeopleHours)
    : summaryLoading
    ? "Loading…"
    : "—";

  const meetingsDisplay = summary
    ? numberFormatter.format(summary.totalMeetings)
    : summaryLoading
    ? "Loading…"
    : "—";

  async function handleCopyShareLink() {
    if (plan !== "pro") {
      setShareError("Upgrade to Pro to enable shareable report links.");
      setShareStatus(null);
      return;
    }

    setCopyingShareLink(true);
    setShareStatus(null);
    setShareError(null);

    try {
      const res = await fetch(`/api/report/weekly-pdf?days=${DAYS}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to generate share link");
      }

      const json = (await res.json()) as { signedUrl?: unknown };
      const signedUrl = typeof json.signedUrl === "string" ? json.signedUrl : "";

      if (!signedUrl) {
        throw new Error("Missing share link");
      }

      await navigator.clipboard.writeText(signedUrl);
      setShareStatus("Link copied (expires in 7 days)");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy share link";
      setShareError(message);
    } finally {
      setCopyingShareLink(false);
    }
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold">Meeting Spend Overview</h1>
          <p className="mt-2 text-muted">
            Weekly cost summary based on your last 30 days of meetings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={plan === "pro" ? `/api/report/weekly-pdf?days=${DAYS}&download=1` : undefined}
            onClick={(event) => {
              if (plan !== "pro") {
                event.preventDefault();
                setShareStatus(null);
                setShareError("Upgrade to Pro to enable PDF reports.");
              }
            }}
            aria-disabled={plan !== "pro"}
            title={plan !== "pro" ? "Upgrade to Pro to enable PDF reports" : undefined}
            className={`rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-foreground hover:bg-background/60 ${
              plan !== "pro" ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            PDF Report
          </a>
          <button
            type="button"
            onClick={() => {
              void handleCopyShareLink();
            }}
            disabled={copyingShareLink || plan !== "pro"}
            title={plan !== "pro" ? "Upgrade to Pro to enable share links" : undefined}
            className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-foreground hover:bg-background/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copyingShareLink ? "Copying..." : "Copy share link"}
          </button>
          <SignOutButton />
        </div>
      </header>

      {shareStatus ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {shareStatus}
        </div>
      ) : null}

      {shareError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {shareError}
        </div>
      ) : null}

      {summaryError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {summaryError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Meeting Spend (USD)" value={costDisplay} />
        <MetricCard label="Total People-Hours" value={hoursDisplay} />
        <MetricCard label="Total Meetings" value={meetingsDisplay} />
      </div>

      <div className="flex items-center gap-3 text-sm text-muted">
        <span>
          Unassigned people:{" "}
          {summary ? numberFormatter.format(summary.unassignedPeopleCount) : summaryLoading ? "Loading…" : "—"}
        </span>
        {summary && summary.unassignedPeopleCount > 0 ? (
          <Link
            href="/dashboard/people"
            className="rounded-md border border-border bg-background/40 px-3 py-1 text-xs text-foreground hover:bg-background/60"
          >
            Assign roles
          </Link>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Spend by Day</h2>
          <span className="text-xs uppercase tracking-[0.3em] text-muted">
            Last 30 days
          </span>
        </div>
        <div className="mt-6 h-64">
          {summaryLoading ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-background/40">
              <p className="text-sm text-muted">Loading chart…</p>
            </div>
          ) : (
            <Bar data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-slate-900/80 to-slate-800/60 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Executive Insight</h2>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
            AI Summary
          </span>
        </div>

        {insightLoading ? (
          <p className="mt-4 text-sm text-slate-300">Generating executive insight…</p>
        ) : null}

        {insightError ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {insightError}
          </p>
        ) : null}

        {!insightLoading && !insightError && insight ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-sky-300/15 bg-slate-900/70 p-4 text-sm leading-6 text-slate-100">
              {insight.insightText}
            </p>
            <ul className="space-y-2 text-sm text-slate-200">
              {insight.bullets.map((bullet) => (
                <li key={bullet} className="rounded-md bg-slate-900/50 px-3 py-2">
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
