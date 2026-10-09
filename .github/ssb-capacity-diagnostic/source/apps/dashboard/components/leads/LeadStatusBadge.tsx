const colors: Record<string, { bg: string; fg: string }> = {
  new: { bg: "#dbeafe", fg: "#1d4ed8" },
  contacted: { bg: "#dcfce7", fg: "#166534" },
  qualified: { bg: "#fef3c7", fg: "#92400e" },
  closed: { bg: "#fee2e2", fg: "#991b1b" },
};

const labels: Record<string, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  qualified: "Qualifiziert",
  closed: "Abgeschlossen",
};

export function LeadStatusBadge({ status }: { status: string }) {
  const color = colors[status] || { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span className="dashboard-badge" style={{ background: color.bg, color: color.fg }}>
      {labels[status] || status}
    </span>
  );
}
