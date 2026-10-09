import type { ReactNode } from "react";

export function BusinessMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="dashboard-card dashboard-card--soft">
      <strong>{value}</strong>
      <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: hint ? 6 : 0 }}>
        {label}
      </p>
      {hint ? (
        <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0, fontSize: 13 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
