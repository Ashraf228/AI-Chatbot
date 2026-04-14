export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <div>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}
