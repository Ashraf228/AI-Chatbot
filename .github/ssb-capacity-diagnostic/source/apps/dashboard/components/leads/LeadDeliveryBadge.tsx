type DeliveryChannelStatus = "not_configured" | "pending" | "sent" | "failed" | "unknown";

type LeadDelivery = {
  stored?: boolean;
  email?: DeliveryChannelStatus;
  webhook?: DeliveryChannelStatus;
};

const badgeStyles: Record<DeliveryChannelStatus | "stored", { bg: string; fg: string }> = {
  stored: { bg: "#f3f4f6", fg: "#374151" },
  not_configured: { bg: "#f3f4f6", fg: "#374151" },
  pending: { bg: "#fef3c7", fg: "#92400e" },
  sent: { bg: "#dcfce7", fg: "#166534" },
  failed: { bg: "#fee2e2", fg: "#991b1b" },
  unknown: { bg: "#e5e7eb", fg: "#374151" },
};

function channelLabel(channel: "email" | "webhook", status: DeliveryChannelStatus) {
  const prefix = channel === "email" ? "E-Mail" : "Webhook";

  if (status === "sent") return `${prefix} gesendet`;
  if (status === "pending") return `${prefix} ausstehend`;
  if (status === "failed") return `${prefix} fehlgeschlagen`;
  if (status === "unknown") return `${prefix} unbekannt`;
  return null;
}

function Badge({ label, status }: { label: string; status: DeliveryChannelStatus | "stored" }) {
  const style = badgeStyles[status];
  return (
    <span className="dashboard-badge" style={{ background: style.bg, color: style.fg }}>
      {label}
    </span>
  );
}

export function LeadDeliveryBadge({ delivery }: { delivery?: LeadDelivery }) {
  const emailStatus = delivery?.email || "not_configured";
  const webhookStatus = delivery?.webhook || "not_configured";
  const labels = [
    channelLabel("email", emailStatus),
    channelLabel("webhook", webhookStatus),
  ].filter(Boolean) as string[];

  if (labels.length === 0) {
    return <Badge label="Gespeichert" status="stored" />;
  }

  return (
    <span className="dashboard-inline dashboard-wrap" style={{ gap: 6 }}>
      <Badge label="Gespeichert" status="stored" />
      {labels.map((label) => {
        const status = label.includes("fehlgeschlagen")
          ? "failed"
          : label.includes("ausstehend")
            ? "pending"
            : label.includes("unbekannt")
              ? "unknown"
              : "sent";
        return <Badge key={label} label={label} status={status} />;
      })}
    </span>
  );
}
