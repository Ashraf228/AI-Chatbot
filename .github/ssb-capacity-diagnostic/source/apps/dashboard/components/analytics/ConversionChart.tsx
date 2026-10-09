type ConversionChartProps = {
  leadRate: number;
  aiAnswerRate: number;
};

export function ConversionChart({ leadRate, aiAnswerRate }: ConversionChartProps) {
  const leadWidth = `${Math.max(4, Math.min(100, leadRate * 100))}%`;
  const answerWidth = `${Math.max(4, Math.min(100, aiAnswerRate * 100))}%`;

  return (
    <div className="dashboard-card">
      <h3 className="dashboard-card-title dashboard-card-title--sm">Quoten</h3>
      <Bar label="Lead-Rate" value={`${(leadRate * 100).toFixed(1)}%`} width={leadWidth} color="#059669" />
      <Bar
        label="AI-Antwortquote"
        value={`${(aiAnswerRate * 100).toFixed(1)}%`}
        width={answerWidth}
        color="#2563eb"
      />
    </div>
  );
}

function Bar({
  label,
  value,
  width,
  color,
}: {
  label: string;
  value: string;
  width: string;
  color: string;
}) {
  return (
    <div className="dashboard-bar-row">
      <div className="dashboard-bar-header">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="dashboard-bar-track">
        <div className="dashboard-bar-fill" style={{ width, background: color }} />
      </div>
    </div>
  );
}
