"use client";

type CustomerStatusBadgeProps = {
  status: "done" | "pending" | "attention";
  label?: string;
};

export function CustomerStatusBadge({ status, label }: CustomerStatusBadgeProps) {
  if (status === "done") {
    return <span className="dashboard-status dashboard-status--success">{label || "Erledigt"}</span>;
  }

  if (status === "attention") {
    return <span className="dashboard-status dashboard-status--warning">{label || "Achtung"}</span>;
  }

  return <span className="dashboard-status dashboard-status--pending">{label || "Offen"}</span>;
}
