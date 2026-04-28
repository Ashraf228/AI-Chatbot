"use client";

import { useEffect, useState } from "react";
import { Topbar } from "../../components/layout/Topbar";
import { Button } from "../../components/shared/Button";
import { EmptyState } from "../../components/shared/EmptyState";
import { ErrorState } from "../../components/shared/ErrorState";
import { Input } from "../../components/shared/Input";

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

function parseJsonResponse<T>(text: string): T | null {
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}

function toErrorMessage(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

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

    let usageData: UsageRow[] | Record<string, unknown> | null = null;
    let summaryData: UsageSummary | Record<string, unknown> | null = null;

    try {
      usageData = parseJsonResponse<UsageRow[] | Record<string, unknown>>(usageText);
      summaryData = parseJsonResponse<UsageSummary | Record<string, unknown>>(summaryText);
    } catch {
      setErr("Ungültige Antwort von /api/usage");
      return;
    }

    if (!usageRes.ok) {
      setErr(toErrorMessage(usageData));
      return;
    }

    if (!summaryRes.ok) {
      setErr(toErrorMessage(summaryData));
      return;
    }

    setRows(Array.isArray(usageData) ? usageData : []);
    setSummary(
      summaryData &&
        typeof summaryData === "object" &&
        !Array.isArray(summaryData) &&
        "total_requests" in summaryData
        ? (summaryData as UsageSummary)
        : null
    );
  }

  useEffect(() => {
    loadUsage();
  }, []);

  return (
    <div>
      <Topbar title="Kosten & Nutzung" />
      <div className="dashboard-page" style={{ maxWidth: 1300 }}>
        <div className="dashboard-inline" style={{ marginBottom: 16 }}>
          <Input
            placeholder="Tenant-ID filtern"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            style={{ flex: 1 }}
          />
          <Input
            placeholder="Kunden-ID filtern"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button onClick={loadUsage}>Laden</Button>
        </div>

        {err && <ErrorState message={err} />}

        {summary && (
          <>
            <div className="dashboard-grid dashboard-grid--metrics-5" style={{ gap: 16, marginBottom: 16 }}>
              <Card title="Anfragen gesamt" value={Number(summary.total_requests).toLocaleString()} />
              <Card title="Tokens gesamt" value={Number(summary.total_tokens).toLocaleString()} />
              <Card title="Eingabe-Tokens" value={Number(summary.total_input_tokens).toLocaleString()} />
              <Card title="Ausgabe-Tokens" value={Number(summary.total_output_tokens).toLocaleString()} />
              <Card
                title="Geschätzte Kosten"
                value={`€${Number(summary.estimated_cost || 0).toFixed(4)}`}
              />
            </div>

            <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16, marginBottom: 24 }}>
              <Card
                title="Nutzer-Nachrichten"
                value={Number(summary.total_user_messages).toLocaleString()}
              />
              <Card
                title="Bot-Nachrichten"
                value={Number(summary.total_assistant_messages).toLocaleString()}
              />
              <Card
                title="Durchschnittliche Latenz"
                value={`${Number(summary.avg_latency_ms || 0).toFixed(0)} ms`}
              />
              <Card
                title="Erfolgsquote"
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

        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Tägliche Nutzung</h2>

          {rows.length === 0 ? (
            <EmptyState title="Keine Nutzungsdaten vorhanden." />
          ) : (
            <div className="dashboard-table-wrap">
              <table className="dashboard-table dashboard-table--usage">
                <thead>
                  <tr>
                    <th className="dashboard-th">Tag</th>
                    <th className="dashboard-th">Tenant</th>
                    <th className="dashboard-th">Kunde</th>
                    <th className="dashboard-th dashboard-th--right">Anfragen</th>
                    <th className="dashboard-th dashboard-th--right">Nutzer</th>
                    <th className="dashboard-th dashboard-th--right">Bot</th>
                    <th className="dashboard-th dashboard-th--right">Eingabe-Tokens</th>
                    <th className="dashboard-th dashboard-th--right">Ausgabe-Tokens</th>
                    <th className="dashboard-th dashboard-th--right">Tokens gesamt</th>
                    <th className="dashboard-th dashboard-th--right">Erfolge</th>
                    <th className="dashboard-th dashboard-th--right">Fehler</th>
                    <th className="dashboard-th dashboard-th--right">Ø Latenz</th>
                    <th className="dashboard-th dashboard-th--right">Kosten (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={`${row.tenant_id}-${row.site_id}-${row.day}-${idx}`}>
                      <td className="dashboard-td">{row.day}</td>
                      <td className="dashboard-td">{row.tenant_id}</td>
                      <td className="dashboard-td">{row.site_id}</td>
                      <td className="dashboard-td dashboard-td--right">{Number(row.request_count).toLocaleString()}</td>
                      <td className="dashboard-td dashboard-td--right">
                        {Number(row.user_message_count).toLocaleString()}
                      </td>
                      <td className="dashboard-td dashboard-td--right">
                        {Number(row.assistant_message_count).toLocaleString()}
                      </td>
                      <td className="dashboard-td dashboard-td--right">{Number(row.input_tokens).toLocaleString()}</td>
                      <td className="dashboard-td dashboard-td--right">{Number(row.output_tokens).toLocaleString()}</td>
                      <td className="dashboard-td dashboard-td--right">{Number(row.total_tokens).toLocaleString()}</td>
                      <td className="dashboard-td dashboard-td--right">{Number(row.success_count).toLocaleString()}</td>
                      <td className="dashboard-td dashboard-td--right">{Number(row.error_count).toLocaleString()}</td>
                      <td className="dashboard-td dashboard-td--right">
                        {Number(row.avg_latency_ms || 0).toFixed(0)} ms
                      </td>
                      <td className="dashboard-td dashboard-td--right">
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
    <div className="dashboard-metric-card">
      <div className="dashboard-metric-label">{title}</div>
      <div className="dashboard-metric-value">{value}</div>
    </div>
  );
}
