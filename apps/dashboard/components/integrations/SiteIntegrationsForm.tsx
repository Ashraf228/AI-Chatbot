"use client";

import { useEffect, useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";

type IntegrationField = {
  key: string;
  label: string;
  kind: "text" | "url" | "email" | "password" | "textarea" | "multiselect";
  placeholder?: string;
  options?: string[];
};

type SiteIntegration = {
  siteId: string;
  id: string | null;
  providerKey: string;
  connectionKey: string;
  type: string;
  label: string;
  description: string;
  category: string;
  displayName: string;
  enabled: boolean;
  status: "connected" | "disconnected";
  supportedEvents: string[];
  selectedEvents: string[];
  testable: boolean;
  config: Record<string, unknown>;
  secretFieldCount: number;
  configuredSecretCount: number;
  configFields: IntegrationField[];
  secretFields: IntegrationField[];
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastError: string | null;
};

type FormState = {
  displayName: string;
  enabled: boolean;
  config: Record<string, string | string[]>;
  secrets: Record<string, string>;
};

function integrationKey(integration: Pick<SiteIntegration, "providerKey" | "connectionKey">) {
  return `${integration.providerKey}:${integration.connectionKey}`;
}

function buildInitialState(integration: SiteIntegration): FormState {
  return {
    displayName: integration.displayName || integration.label,
    enabled: integration.enabled || integration.status === "connected",
    config: Object.fromEntries(
      integration.configFields.map((field) => {
        if (field.kind === "multiselect") {
          return [field.key, integration.selectedEvents || []];
        }
        return [field.key, String(integration.config?.[field.key] || "")];
      }),
    ),
    secrets: Object.fromEntries(integration.secretFields.map((field) => [field.key, ""])),
  };
}

function cleanSecrets(secrets: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(secrets).filter(([, value]) => value.trim().length > 0),
  );
}

function statusLabel(integration: SiteIntegration) {
  if (integration.enabled) {
    return "Aktiv";
  }
  return "Inaktiv";
}

function categoryLabel(category: string) {
  switch (category) {
    case "automation":
      return "Automation";
    case "messaging":
      return "Benachrichtigung";
    case "support":
      return "Support";
    case "commerce":
      return "E-Commerce";
    default:
      return category;
  }
}

export function SiteIntegrationsForm({ siteId }: { siteId: string }) {
  const [integrations, setIntegrations] = useState<SiteIntegration[]>([]);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadIntegrations() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/integrations/${siteId}`, { cache: "no-store" });
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      setError(data?.message || "Verbindungen konnten nicht geladen werden.");
      setLoading(false);
      return;
    }

    const items = Array.isArray(data) ? data : [];
    setIntegrations(items);
    setForms(
      Object.fromEntries(
        items.map((integration: SiteIntegration) => [
          integrationKey(integration),
          buildInitialState(integration),
        ]),
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  function updateForm(
    key: string,
    patch: Partial<FormState> | ((current: FormState) => FormState),
  ) {
    setForms((current) => {
      const existing = current[key];
      if (!existing) {
        return current;
      }
      const next = typeof patch === "function" ? patch(existing) : { ...existing, ...patch };
      return { ...current, [key]: next };
    });
  }

  async function saveIntegration(integration: SiteIntegration) {
    const key = integrationKey(integration);
    const form = forms[key];
    if (!form) return;

    setBusyKey(key);
    setMessage(null);
    setError(null);

    const payload = {
      providerKey: integration.providerKey,
      connectionKey: integration.connectionKey,
      displayName: form.displayName,
      enabled: form.enabled,
      config: form.config,
      secrets: cleanSecrets(form.secrets),
    };

    const endpoint = integration.id
      ? `/api/integrations/${siteId}/${integration.id}`
      : `/api/integrations/${siteId}`;
    const res = await fetch(endpoint, {
      method: integration.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.message || "Verbindung konnte nicht gespeichert werden.");
      setBusyKey(null);
      return;
    }

    await loadIntegrations();
    setMessage("Verbindung gespeichert.");
    setBusyKey(null);
  }

  async function deleteIntegration(integration: SiteIntegration) {
    if (!integration.id) {
      return;
    }
    const confirmed = window.confirm("Diese Verbindung wirklich löschen?");
    if (!confirmed) {
      return;
    }
    const key = integrationKey(integration);
    setBusyKey(key);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/integrations/${siteId}/${integration.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.message || "Verbindung konnte nicht gelöscht werden.");
      setBusyKey(null);
      return;
    }

    await loadIntegrations();
    setMessage("Verbindung gelöscht.");
    setBusyKey(null);
  }

  async function testIntegration(integration: SiteIntegration) {
    if (!integration.id) {
      setError("Bitte speichere die Verbindung zuerst.");
      return;
    }
    const key = integrationKey(integration);
    setBusyKey(key);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/integrations/${siteId}/${integration.id}/test`, {
      method: "POST",
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || data?.status === "failed") {
      setError(data?.message || "Verbindungstest fehlgeschlagen.");
      await loadIntegrations();
      setBusyKey(null);
      return;
    }

    await loadIntegrations();
    setMessage(data?.message || "Verbindung erfolgreich getestet.");
    setBusyKey(null);
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error && integrations.length === 0) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="dashboard-card dashboard-stack">
      <div>
        <p className="dashboard-eyebrow">Verbindungen</p>
        <h2 className="dashboard-card-title">Externe Systeme anbinden</h2>
        <p className="dashboard-copy">
          Aktiviere pro Kunde Webhooks, CRM-Weiterleitungen, Ticket-Weiterleitungen oder
          Benachrichtigungen. Zugangsdaten werden nicht im Klartext angezeigt.
        </p>
      </div>

      {error ? <p className="dashboard-status dashboard-status--error">{error}</p> : null}
      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}

      <div className="dashboard-stack dashboard-stack--sm">
        {integrations.map((integration) => {
          const key = integrationKey(integration);
          const form = forms[key];
          if (!form) return null;
          const busy = busyKey === key;

          return (
            <section key={key} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <div className="dashboard-section-heading">
                <div>
                  <h3 className="dashboard-card-title dashboard-card-title--sm">{integration.label}</h3>
                  <p className="dashboard-copy dashboard-copy--muted">{integration.description}</p>
                  <p className="dashboard-copy dashboard-copy--muted">
                    {categoryLabel(integration.category)} · {statusLabel(integration)}
                    {integration.lastTestedAt
                      ? ` · letzter Test ${new Date(integration.lastTestedAt).toLocaleString("de-DE")}`
                      : ""}
                  </p>
                  {integration.lastError ? (
                    <p className="dashboard-status dashboard-status--error">{integration.lastError}</p>
                  ) : null}
                </div>
                <div className="dashboard-actions">
                  <Button variant="secondary" onClick={() => void testIntegration(integration)} disabled={busy || !integration.testable}>
                    Testen
                  </Button>
                  {integration.id ? (
                    <Button variant="danger" onClick={() => void deleteIntegration(integration)} disabled={busy}>
                      Löschen
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="dashboard-grid dashboard-grid--2">
                <div className="dashboard-field">
                  <label className="dashboard-field-label">Name</label>
                  <Input
                    value={form.displayName}
                    onChange={(event) =>
                      updateForm(key, (current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="dashboard-field">
                  <label className="dashboard-field-label">Status</label>
                  <Select
                    value={form.enabled ? "enabled" : "disabled"}
                    onChange={(event) =>
                      updateForm(key, (current) => ({
                        ...current,
                        enabled: event.target.value === "enabled",
                      }))
                    }
                  >
                    <option value="disabled">Inaktiv</option>
                    <option value="enabled">Aktiv</option>
                  </Select>
                </div>
              </div>

              {integration.configFields.map((field) => (
                <div key={field.key} className="dashboard-field">
                  <label className="dashboard-field-label">{field.label}</label>
                  <FieldInput
                    field={field}
                    value={form.config[field.key]}
                    onChange={(value) =>
                      updateForm(key, (current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          [field.key]: value,
                        },
                      }))
                    }
                  />
                </div>
              ))}

              {integration.secretFields.length ? (
                <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
                  <p className="dashboard-copy dashboard-copy--muted">
                    Secret-Felder werden nur gesetzt, wenn du hier einen neuen Wert einträgst.
                    Bereits konfigurierte Secrets: {integration.configuredSecretCount}/{integration.secretFieldCount}.
                  </p>
                  {integration.secretFields.map((field) => (
                    <div key={field.key} className="dashboard-field">
                      <label className="dashboard-field-label">{field.label}</label>
                      <Input
                        type="password"
                        placeholder="Neuen Secret-Wert nur bei Bedarf setzen"
                        value={form.secrets[field.key] || ""}
                        onChange={(event) =>
                          updateForm(key, (current) => ({
                            ...current,
                            secrets: {
                              ...current.secrets,
                              [field.key]: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="dashboard-actions">
                <Button onClick={() => void saveIntegration(integration)} disabled={busy}>
                  {busy ? "Speichert..." : integration.id ? "Speichern" : "Hinzufügen"}
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: IntegrationField;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  if (field.kind === "textarea") {
    return (
      <textarea
        className="dashboard-textarea dashboard-mono"
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
      />
    );
  }

  if (field.kind === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <select
        className="dashboard-select"
        multiple
        value={selected}
        onChange={(event) =>
          onChange(Array.from(event.target.selectedOptions).map((option) => option.value))
        }
      >
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {eventLabel(option)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      type={field.kind === "password" ? "password" : field.kind}
      placeholder={field.placeholder}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function eventLabel(event: string) {
  switch (event) {
    case "lead.created":
      return "Neue Anfrage";
    case "ticket.created":
      return "Neues Ticket";
    case "contact.requested":
      return "Kontaktwunsch";
    case "conversation.handoff":
      return "Menschliche Übergabe";
    case "tool.executed":
      return "Aktion ausgeführt";
    default:
      return event;
  }
}
