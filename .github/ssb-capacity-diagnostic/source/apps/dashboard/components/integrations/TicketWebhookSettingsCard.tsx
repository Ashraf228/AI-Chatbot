"use client";

import { useEffect, useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";

type TicketWebhookConfig = {
  enabled: boolean;
  label: string;
  targetUrl: string;
  hasSigningSecret: boolean;
  signingMode: "hmac_sha256" | "legacy_secret_header";
  lastTestStatus: string | null;
  lastTestAt: string | null;
  lastError: string | null;
  forwardingConfigured: boolean;
  status: "not_configured" | "active" | "test_queued" | "test_success" | "test_failed";
};

type FormState = {
  enabled: boolean;
  label: string;
  targetUrl: string;
  signingSecret: string;
};

function initialForm(config: TicketWebhookConfig): FormState {
  return {
    enabled: config.enabled,
    label: config.label || "Ticket-Weiterleitung",
    targetUrl: config.targetUrl || "",
    signingSecret: "",
  };
}

function statusLabel(config: TicketWebhookConfig) {
  switch (config.status) {
    case "test_success":
      return "Test erfolgreich";
    case "test_queued":
      return "Test eingereiht";
    case "test_failed":
      return "Test fehlgeschlagen";
    case "active":
      return "Aktiv";
    case "not_configured":
    default:
      return "Nicht konfiguriert";
  }
}

function statusClass(config: TicketWebhookConfig) {
  if (config.status === "test_failed") return "dashboard-status dashboard-status--error";
  if (config.status === "not_configured") return "dashboard-status";
  return "dashboard-status dashboard-status--success";
}

function generateSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function isValidWebhookUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function TicketWebhookSettingsCard({ siteId }: { siteId: string }) {
  const statusFieldId = `ticket-webhook-status-${siteId}`;
  const labelFieldId = `ticket-webhook-label-${siteId}`;
  const urlFieldId = `ticket-webhook-url-${siteId}`;
  const secretFieldId = `ticket-webhook-secret-${siteId}`;
  const [config, setConfig] = useState<TicketWebhookConfig | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/sites/${siteId}/ticket-webhook`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      setError(data?.message || "Ticket-Weiterleitung konnte nicht geladen werden.");
      setLoading(false);
      return;
    }
    setConfig(data);
    setForm(initialForm(data));
    setLoading(false);
  }

  useEffect(() => {
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function saveConfig(rotateSecret = false) {
    if (!form) return;
    if (form.enabled && !isValidWebhookUrl(form.targetUrl)) {
      setError("Bitte tragen Sie eine gültige Webhook-URL ein.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/sites/${siteId}/ticket-webhook`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: form.enabled,
        label: form.label,
        targetUrl: form.targetUrl,
        signingSecret: form.signingSecret,
        rotateSecret,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      setError(data?.message || "Ticket-Weiterleitung konnte nicht gespeichert werden.");
      setBusy(false);
      return;
    }

    setConfig(data);
    setForm({ ...initialForm(data), signingSecret: "" });
    setMessage(rotateSecret ? "Signing Secret wurde rotiert." : "Ticket-Weiterleitung gespeichert.");
    setBusy(false);
  }

  async function disableConfig() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/sites/${siteId}/ticket-webhook`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      setError(data?.message || "Ticket-Weiterleitung konnte nicht deaktiviert werden.");
      setBusy(false);
      return;
    }

    setConfig(data);
    setForm(initialForm(data));
    setMessage("Ticket-Weiterleitung deaktiviert.");
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/sites/${siteId}/ticket-webhook/test`, {
      method: "POST",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.status === "failed") {
      setError(data?.message || "Test-Webhook konnte nicht eingereiht werden.");
      if (data?.config) {
        setConfig(data.config);
        setForm(initialForm(data.config));
      }
      setBusy(false);
      return;
    }

    if (data?.config) {
      setConfig(data.config);
      setForm(initialForm(data.config));
    }
    setMessage(data?.message || "Test-Webhook wurde eingereiht.");
    setBusy(false);
  }

  if (loading) {
    return <LoadingState />;
  }

  if (!config || !form) {
    return <ErrorState message={error || "Ticket-Weiterleitung konnte nicht geladen werden."} />;
  }

  return (
    <section className="dashboard-card dashboard-stack">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-eyebrow">IT-Support Agent</p>
          <h2 className="dashboard-card-title">Ticket-Weiterleitung</h2>
          <p className="dashboard-copy">
            Leiten Sie vom IT-Support-Agenten erstellte Tickets automatisch an n8n, Make,
            ein Ticketsystem oder eine eigene Webhook-URL weiter.
          </p>
        </div>
        <span className={statusClass(config)}>{statusLabel(config)}</span>
      </div>

      {error ? <p className="dashboard-status dashboard-status--error">{error}</p> : null}
      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}

      <div className="dashboard-grid dashboard-grid--2">
        <div className="dashboard-field">
          <label className="dashboard-field-label" htmlFor={statusFieldId}>Status</label>
          <select
            id={statusFieldId}
            className="dashboard-select"
            value={form.enabled ? "enabled" : "disabled"}
            onChange={(event) =>
              setForm((current) =>
                current ? { ...current, enabled: event.target.value === "enabled" } : current,
              )
            }
          >
            <option value="disabled">Inaktiv</option>
            <option value="enabled">Aktiv</option>
          </select>
        </div>

        <div className="dashboard-field">
          <label className="dashboard-field-label" htmlFor={labelFieldId}>Label</label>
          <Input
            id={labelFieldId}
            value={form.label}
            placeholder="Ticket-Weiterleitung"
            onChange={(event) =>
              setForm((current) => current ? { ...current, label: event.target.value } : current)
            }
          />
        </div>
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor={urlFieldId}>Webhook-URL</label>
        <Input
          id={urlFieldId}
          type="url"
          value={form.targetUrl}
          placeholder="https://example.com/ticket-webhook"
          onChange={(event) =>
            setForm((current) => current ? { ...current, targetUrl: event.target.value } : current)
          }
        />
        <p className="dashboard-copy dashboard-copy--muted">
          Bei aktiver Weiterleitung wird jedes neue <code>ticket.created</code> Ereignis an diese URL eingereiht.
        </p>
      </div>

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        <div className="dashboard-section-heading">
          <div>
            <h3 className="dashboard-card-title dashboard-card-title--sm">Signing Secret</h3>
            <p className="dashboard-copy dashboard-copy--muted">
              {config.signingMode === "legacy_secret_header"
                ? "Legacy-Secret-Header: bestehende Empfänger können weiterlaufen. Planen Sie eine Migration auf HMAC-SHA256."
                : "HMAC-SHA256: Der Inhalt wird signiert; das Secret wird nicht mit der Anfrage übertragen."}
            </p>
            <p className="dashboard-copy dashboard-copy--muted">
              {config.hasSigningSecret
                ? "Secret vorhanden. Der Wert wird nicht im Klartext angezeigt."
                : "Für HMAC-SHA256 wird ein Secret mit mindestens 32 zufälligen Bytes benötigt."}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setForm((current) =>
                current ? { ...current, signingSecret: generateSecret() } : current,
              )
            }
            disabled={busy}
          >
            Secret generieren
          </Button>
        </div>
        <Input
          id={secretFieldId}
          aria-label="Signing Secret"
          type="password"
          value={form.signingSecret}
          placeholder="Neues Secret nur bei Bedarf setzen"
          onChange={(event) =>
            setForm((current) => current ? { ...current, signingSecret: event.target.value } : current)
          }
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => void saveConfig(true)}
          disabled={busy || !form.targetUrl}
        >
          Secret serverseitig rotieren
        </Button>
      </div>

      <div className="dashboard-grid dashboard-grid--2">
        <div>
          <p className="dashboard-copy dashboard-copy--muted">
            Letzter Test: {config.lastTestAt ? new Date(config.lastTestAt).toLocaleString("de-DE") : "noch nicht getestet"}
          </p>
          {config.lastError ? (
            <p className="dashboard-status dashboard-status--error">{config.lastError}</p>
          ) : null}
        </div>
        <div className="dashboard-actions">
          <Button variant="secondary" onClick={() => void sendTest()} disabled={busy || !config.forwardingConfigured}>
            Test-Webhook senden
          </Button>
          <Button onClick={() => void saveConfig()} disabled={busy}>
            {busy ? "Speichert..." : "Speichern"}
          </Button>
          <Button variant="danger" onClick={() => void disableConfig()} disabled={busy || !config.forwardingConfigured}>
            Deaktivieren
          </Button>
        </div>
      </div>
    </section>
  );
}
