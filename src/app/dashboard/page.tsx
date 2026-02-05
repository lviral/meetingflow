import { MetricCard } from "@/components/MetricCard";

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-muted">Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold">Meeting Spend Overview</h1>
        <p className="mt-2 text-muted">
          Placeholder metrics and chart area for the upcoming analytics.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Meeting Spend" value="$—" />
        <MetricCard label="People-Hours" value="—" />
        <MetricCard label="Big Meeting Spend (8+ attendees)" value="$—" />
      </div>

      <div className="rounded-2xl border border-border bg-surface/60 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Spend by Department</h2>
          <span className="text-xs uppercase tracking-[0.3em] text-muted">
            Bar chart placeholder
          </span>
        </div>
        <div className="mt-6 flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-background/40">
          <p className="text-sm text-muted">Bar chart will render here</p>
        </div>
      </div>
    </section>
  );
}