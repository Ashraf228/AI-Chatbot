"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Topbar } from "../../components/layout/Topbar";

type UsageRow = {
  tenant_id: string;
  site_id: string;
  day: string;
  request_count: number;
  user_message_count: number;
  assistant_message_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number;
};

type UsageSummary = {
  total_requests: number;
  total_user_messages: number;
  total_assistant_messages: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  total_success_count: number;
  total_error_count: number;
  avg_latency_ms: number;
};

export default function UsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function loadUsage() {
    setErr(null);

    const params = new URLSearchParams();
    if (tenantId) params.set("tenantId", tenantId);
    if (siteId) params.set("siteId", siteId);

    const usageUrl = `/api/usage${params.toString() ? `?${params.toString()}` : ""}`;

    const summaryParams = new URLSearchParams();
    if (tenantId) summaryParams.set("tenantId", tenantId);
    if (siteId) summaryParams.set("siteId", siteId);
    summaryParams.set("summary", "1");

    const summaryUrl = `/api/usage?${summaryParams.toString()}`;

    const [usageRes, summaryRes] = await Promise.all([
      fetch(usageUrl, { cache: "no-store" }),
      fetch(summaryUrl, { cache: "no-store" }),
    ]);

    const usageText = await usageRes.text();
    const summaryText = await summaryRes.text();

    let usageData: any = [];
    let summaryData: any = {};

    try {
      usageData = usageText ? JSON.parse(usageText) : [];
      summaryData = summaryText ? JSON.parse(summaryText) : {};
    } catch {
      setErr("Ungültige Antwort von /api/usage");
      return;
    }

    if (!usageRes.ok) {
      setErr(typeof usageData === "string" ? usageData : JSON.stringify(usageData));
      return;
    }

    if (!summaryRes.ok) {
      setErr(typeof summaryData === "string" ? summaryData : JSON.stringify(summaryData));
      return;
    }

    setRows(Array.isArray(usageData) ? usageData : []);
    setSummary(summaryData);
  }

  useEffect(() => {
    loadUsage();
  }, []);

  return (
    <div>
      <Topbar title="Usage & Kosten" />
      <div style={{ maxWidth: 1300, padding: 24 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <input
            placeholder="tenantId filtern"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            style={{ padding: 10, flex: 1 }}
          />
          <input
            placeholder="siteId filtern"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            style={{ padding: 10, flex: 1 }}
          />
          <button onClick={loadUsage} style={{ padding: 10 }}>
            Laden
          </button>
        </div>

        {err && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>}

        {summary && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <Card title="Total Requests" value={Number(summary.total_requests).toLocaleString()} />
              <Card title="Total Tokens" value={Number(summary.total_tokens).toLocaleString()} />
              <Card title="Input Tokens" value={Number(summary.total_input_tokens).toLocaleString()} />
              <Card title="Output Tokens" value={Number(summary.total_output_tokens).toLocaleString()} />
              <Card
                title="Geschätzte Kosten"
                value={`€${Number(summary.estimated_cost || 0).toFixed(4)}`}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <Card
                title="User Messages"
                value={Number(summary.total_user_messages).toLocaleString()}
              />
              <Card
                title="Assistant Messages"
                value={Number(summary.total_assistant_messages).toLocaleString()}
              />
              <Card
                title="Avg Latency"
                value={`${Number(summary.avg_latency_ms || 0).toFixed(0)} ms`}
              />
              <Card
                title="Success Rate"
                value={
                  Number(summary.total_success_count) + Number(summary.total_error_count) > 0
                    ? `${(
                        (Number(summary.total_success_count) /
                          (Number(summary.total_success_count) +
                            Number(summary.total_error_count))) *
                        100
                      ).toFixed(1)}%`
                    : "0%"
                }
              />
            </div>
          </>
        )}

        <div
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h2>Tägliche Nutzung</h2>

          {rows.length === 0 ? (
            <p>Keine Usage-Daten vorhanden.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tag</th>
                    <th style={thStyle}>Tenant</th>
                    <th style={thStyle}>Site</th>
                    <th style={thStyleRight}>Requests</th>
                    <th style={thStyleRight}>User</th>
                    <th style={thStyleRight}>Assistant</th>
                    <th style={thStyleRight}>Input Tokens</th>
                    <th style={thStyleRight}>Output Tokens</th>
                    <th style={thStyleRight}>Total Tokens</th>
                    <th style={thStyleRight}>Success</th>
                    <th style={thStyleRight}>Errors</th>
                    <th style={thStyleRight}>Avg Latency</th>
                    <th style={thStyleRight}>Kosten (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={`${row.tenant_id}-${row.site_id}-${row.day}-${idx}`}>
                      <td style={tdStyle}>{row.day}</td>
                      <td style={tdStyle}>{row.tenant_id}</td>
                      <td style={tdStyle}>{row.site_id}</td>
                      <td style={tdStyleRight}>{Number(row.request_count).toLocaleString()}</td>
                      <td style={tdStyleRight}>
                        {Number(row.user_message_count).toLocaleString()}
                      </td>
                      <td style={tdStyleRight}>
                        {Number(row.assistant_message_count).toLocaleString()}
                      </td>
                      <td style={tdStyleRight}>{Number(row.input_tokens).toLocaleString()}</td>
                      <td style={tdStyleRight}>{Number(row.output_tokens).toLocaleString()}</td>
                      <td style={tdStyleRight}>{Number(row.total_tokens).toLocaleString()}</td>
                      <td style={tdStyleRight}>{Number(row.success_count).toLocaleString()}</td>
                      <td style={tdStyleRight}>{Number(row.error_count).toLocaleString()}</td>
                      <td style={tdStyleRight}>
                        {Number(row.avg_latency_ms || 0).toFixed(0)} ms
                      </td>
                      <td style={tdStyleRight}>
                        €{Number(row.estimated_cost || 0).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #ddd",
  fontSize: 13,
};

const thStyleRight: CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f0f0f0",
  fontSize: 14,
};

const tdStyleRight: CSSProperties = {
  ...tdStyle,
  textAlign: "right",
};
