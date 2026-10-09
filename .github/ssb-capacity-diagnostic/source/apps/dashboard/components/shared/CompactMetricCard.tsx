type CompactMetricCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function CompactMetricCard({ label, value, hint }: CompactMetricCardProps) {
  return (
    <div className="compact-metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
