type MetricCardProps = {
  label: string;
  value?: string;
};

export function MetricCard({ label, value = "--" }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}