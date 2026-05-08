"use client";

import { useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Select } from "../shared/Select";

type DeleteScope = "leads" | "conversations" | "knowledge" | "reports" | "technical" | "all";

const DELETE_SCOPE_OPTIONS: Array<{ value: DeleteScope; label: string }> = [
  { value: "leads", label: "Anfragen" },
  { value: "conversations", label: "Chats" },
  { value: "knowledge", label: "Wissen" },
  { value: "reports", label: "Berichte" },
  { value: "technical", label: "Technische Protokolle" },
  { value: "all", label: "Alle unterstützten Bereiche" },
];

export function CustomerDataPrivacyActions({
  siteId,
  role,
}: {
  siteId: string;
  role: string;
}) {
  const [scope, setScope] = useState<DeleteScope>("leads");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canDelete = role === "admin" && confirmation === "LÖSCHEN";

  async function exportData() {
    setBusy("export");
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/export`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Datenexport konnte nicht erstellt werden.");
      setBusy(null);
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kunden-export-${siteId}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Datenexport erstellt.");
    setBusy(null);
  }

  async function deleteData() {
    setBusy("delete");
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/delete-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, confirm: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Daten konnten nicht gelöscht werden.");
      setBusy(null);
      return;
    }

    setConfirmation("");
    setMessage(`Daten gelöscht: ${Object.entries(data.deleted || {}).map(([key, value]) => `${key}: ${value}`).join(", ")}`);
    setBusy(null);
  }

  return (
    <section className="dashboard-card dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">DSGVO-Daten</h2>
        <p className="dashboard-copy">
          Exportiere oder lösche site-bezogene Kundendaten. Audit-Logs bleiben als Nachweis erhalten.
        </p>
      </div>

      <div className="dashboard-inline dashboard-wrap">
        <Button type="button" onClick={exportData} disabled={Boolean(busy)}>
          {busy === "export" ? "Exportiert..." : "Daten exportieren"}
        </Button>
      </div>

      {role === "admin" ? (
        <div className="dashboard-card dashboard-card--soft dashboard-stack">
          <div>
            <h3 className="dashboard-card-title dashboard-card-title--sm">Daten löschen</h3>
            <p className="dashboard-copy dashboard-copy--muted">
              Die Site selbst und Audit-Logs werden nicht gelöscht. Zum Bestätigen exakt LÖSCHEN eingeben.
            </p>
          </div>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Bereich</span>
            <Select value={scope} onChange={(event) => setScope(event.target.value as DeleteScope)}>
              {DELETE_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Bestätigung</span>
            <input
              className="dashboard-control"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="LÖSCHEN"
            />
          </label>
          <Button type="button" variant="danger" onClick={deleteData} disabled={!canDelete || Boolean(busy)}>
            {busy === "delete" ? "Löscht..." : "Daten löschen"}
          </Button>
        </div>
      ) : null}

      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}
    </section>
  );
}
