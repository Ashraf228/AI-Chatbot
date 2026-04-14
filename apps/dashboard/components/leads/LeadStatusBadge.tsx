const colors: Record<string, { bg: string; fg: string }> = {
  new: { bg: "#dbeafe", fg: "#1d4ed8" },
  contacted: { bg: "#dcfce7", fg: "#166534" },
  qualified: { bg: "#fef3c7", fg: "#92400e" },
  lost: { bg: "#fee2e2", fg: "#991b1b" },
};

export function LeadStatusBadge({ status }: { status: string }) {
  const color = colors[status] || { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        background: color.bg,
        color: color.fg,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}
