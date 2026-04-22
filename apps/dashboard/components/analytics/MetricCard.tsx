export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="dashboard-metric-card">
      <div className="dashboard-metric-label">{label}</div>
      <strong className="dashboard-metric-value">{value}</strong>
    </div>
  );
}
