type ConversionChartProps = {
  leadRate: number;
  aiAnswerRate: number;
};

export function ConversionChart({ leadRate, aiAnswerRate }: ConversionChartProps) {
  const leadWidth = `${Math.max(4, Math.min(100, leadRate * 100))}%`;
  const answerWidth = `${Math.max(4, Math.min(100, aiAnswerRate * 100))}%`;

  return (
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>Quoten</h3>
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
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ width, height: "100%", background: color }} />
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};
import type { CSSProperties } from "react";
