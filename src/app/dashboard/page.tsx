"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import SignOutButton from "@/app/dashboard/SignOutButton";

type WeeklySummary = {
  totalMeetings: number;
  totalHours: number;
  totalCostUSD: number;
};

type SummaryResponse = {
  summary: WeeklySummary;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const res = await fetch("/api/calendar/last-week", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load meeting summary");
        }

        const json = (await res.json()) as SummaryResponse;
        if (isMounted) {
          setSummary(json.summary);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

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

  const costDisplay = summary
    ? currencyFormatter.format(summary.totalCostUSD)
    : loading
    ? "Loading…"
    : "—";

  const hoursDisplay = summary
    ? numberFormatter.format(summary.totalHours)
    : loading
    ? "Loading…"
    : "—";

  const meetingsDisplay = summary
    ? numberFormatter.format(summary.totalMeetings)
    : loading
    ? "Loading…"
    : "—";

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold">Meeting Spend Overview</h1>
          <p className="mt-2 text-muted">
            Weekly cost summary based on your last 7 days of meetings.
          </p>
        </div>
        <SignOutButton />
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Meeting Spend (USD)" value={costDisplay} />
        <MetricCard label="Total People-Hours" value={hoursDisplay} />
        <MetricCard label="Total Meetings" value={meetingsDisplay} />
      </div>
    </section>
  );
}
