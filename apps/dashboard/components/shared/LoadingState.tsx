export function LoadingState({ label = "Daten werden geladen..." }: { label?: string }) {
  return (
    <div className="dashboard-loading" role="status" aria-live="polite">
      <span className="dashboard-loading__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
