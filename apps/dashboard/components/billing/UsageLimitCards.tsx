"use client";

type LimitCheck = {
  key: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
};

const LABELS: Record<string, string> = {
  maxSites: "Kunden",
  monthlyMessages: "Nachrichten im Monat",
  monthlyLeads: "Anfragen im Monat",
  maxKnowledgeSources: "Wissensquellen",
  maxIntegrations: "Verbindungen",
};

export function UsageLimitCards({ checks }: { checks: LimitCheck[] }) {
  if (!checks.length) {
    return <p className="dashboard-empty">Für diesen Plan sind keine harten Limits gesetzt.</p>;
  }

  return (
    <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
      {checks.map((check) => {
        const percent = check.limit && check.limit > 0
          ? Math.min(100, Math.round((check.used / check.limit) * 100))
          : 0;
        return (
          <div key={check.key} className="dashboard-metric-card">
            <div className="dashboard-metric-label">{LABELS[check.key] || check.key}</div>
            <strong className="dashboard-metric-value">
              {formatNumber(check.used)} / {check.limit === null ? "∞" : formatNumber(check.limit)}
            </strong>
            <div className="dashboard-bar-row">
              <div className="dashboard-bar-header">
                <span>{check.limit === null ? "Unlimitiert" : `${percent}% genutzt`}</span>
                <span className={check.allowed ? "dashboard-badge" : "dashboard-status dashboard-status--error"}>
                  {check.allowed ? "OK" : "Limit erreicht"}
                </span>
              </div>
              <div className="dashboard-bar-track">
                <div
                  className="dashboard-bar-fill"
                  style={{ width: `${check.limit === null ? 0 : percent}%`, background: check.allowed ? "#111" : "#b91c1c" }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE").format(value || 0);
}
