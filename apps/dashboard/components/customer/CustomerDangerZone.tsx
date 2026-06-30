"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";

export function CustomerDangerZone({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"disable-widget" | "delete-site" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmation === "löschen";

  async function disableWidget() {
    setBusy("disable-widget");
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/widget/config/${encodeURIComponent(siteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Widget konnte nicht deaktiviert werden.");
      setBusy(null);
      return;
    }

    setMessage("Widget deaktiviert. Der Kunde bleibt erhalten und kann später wieder aktiviert werden.");
    setBusy(null);
    router.refresh();
  }

  async function deleteSite() {
    setBusy("delete-site");
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Kunde konnte nicht gelöscht werden.");
      setBusy(null);
      return;
    }

    router.push("/sites");
    router.refresh();
  }

  return (
    <section className="dashboard-card dashboard-stack">
      <div>
        <p className="dashboard-eyebrow">Gefahrenbereich</p>
        <h2 className="dashboard-card-title">Widget oder Kunde entfernen</h2>
        <p className="dashboard-copy">
          Deaktivieren stoppt nur das Widget. Komplett löschen entfernt den Kunden und die zugehörigen
          Site-Daten endgültig aus der Anwendung.
        </p>
      </div>

      <div className="dashboard-card dashboard-card--soft dashboard-stack">
        <div>
          <h3 className="dashboard-card-title dashboard-card-title--sm">Widget deaktivieren</h3>
          <p className="dashboard-copy dashboard-copy--muted">
            Das Widget wird pausiert. Konfiguration, Wissen, Chats und Anfragen bleiben erhalten.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={disableWidget} disabled={Boolean(busy)}>
          {busy === "disable-widget" ? "Deaktiviert..." : "Widget deaktivieren"}
        </Button>
      </div>

      <div className="dashboard-card dashboard-card--soft dashboard-stack">
        <div>
          <h3 className="dashboard-card-title dashboard-card-title--sm">Kunde komplett löschen</h3>
          <p className="dashboard-copy dashboard-copy--muted">
            Diese Aktion entfernt den Kunden inklusive Widget, Konfiguration, Wissen, Chats, Anfragen,
            Reports, Integrationen und technischen Jobs. Zum Bestätigen exakt <strong>löschen</strong> eingeben.
          </p>
        </div>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Bestätigung</span>
          <input
            className="dashboard-control"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="löschen"
            autoComplete="off"
          />
        </label>
        <Button type="button" variant="danger" onClick={deleteSite} disabled={!canDelete || Boolean(busy)}>
          {busy === "delete-site" ? "Löscht..." : "Kunde endgültig löschen"}
        </Button>
      </div>

      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}
    </section>
  );
}
