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
  kind: "text" | "url" | "email" | "password";
  placeholder?: string;
};

type SiteIntegration = {
  siteId: string;
  providerKey: string;
  connectionKey: string;
  label: string;
  description: string;
  category: string;
  displayName: string;
  status: "connected" | "disconnected";
  config: Record<string, unknown>;
  secretFieldCount: number;
  configuredSecretCount: number;
  configFields: IntegrationField[];
  secretFields: IntegrationField[];
};

type FormState = {
  displayName: string;
  status: "connected" | "disconnected";
  config: Record<string, string>;
  secrets: Record<string, string>;
};

function buildInitialState(integration: SiteIntegration): FormState {
  return {
    displayName: integration.displayName || integration.label,
    status: integration.status,
    config: Object.fromEntries(
      integration.configFields.map((field) => [field.key, String(integration.config?.[field.key] || "")]),
    ),
    secrets: Object.fromEntries(integration.secretFields.map((field) => [field.key, ""])),
  };
}

export function SiteIntegrationsForm({ siteId }: { siteId: string }) {
  const [integrations, setIntegrations] = useState<SiteIntegration[]>([]);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/integrations/${siteId}`, { cache: "no-store" });
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        setError(data?.message || "Integrationen konnten nicht geladen werden.");
        setLoading(false);
        return;
      }

      const items = Array.isArray(data) ? data : [];
      setIntegrations(items);
      setForms(
        Object.fromEntries(
          items.map((integration: SiteIntegration) => [
            `${integration.providerKey}:${integration.connectionKey}`,
            buildInitialState(integration),
          ]),
        ),
      );
      setLoading(false);
    }

    load();
  }, [siteId]);

  async function saveIntegrations() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        connections: integrations.map((integration) => {
          const key = `${integration.providerKey}:${integration.connectionKey}`;
          const form = forms[key];

          return {
            providerKey: integration.providerKey,
            connectionKey: integration.connectionKey,
            displayName: form.displayName,
            status: form.status,
            config: {
              values: form.config,
            },
            secrets: {
              values: form.secrets,
            },
          };
        }),
      };

      const res = await fetch(`/api/integrations/${siteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        setError(data?.message || "Integrationen konnten nicht gespeichert werden.");
        return;
      }

      const items = Array.isArray(data) ? data : [];
      setIntegrations(items);
      setForms(
        Object.fromEntries(
          items.map((integration: SiteIntegration) => [
            `${integration.providerKey}:${integration.connectionKey}`,
            buildInitialState(integration),
          ]),
        ),
      );
      setMessage("Integrationen gespeichert.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="dashboard-card dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">Integrationen & Zugangsdaten</h2>
        <p className="dashboard-copy">
          Hier bereitest du externe Systeme pro Kunde vor. Secret-Werte werden gespeichert, aber
          aus Sicherheitsgruenden nicht wieder im Klartext angezeigt.
        </p>
      </div>

      <div className="dashboard-stack dashboard-stack--sm">
        {integrations.map((integration) => {
          const key = `${integration.providerKey}:${integration.connectionKey}`;
          const form = forms[key];
          if (!form) return null;

          return (
            <div key={key} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <div>
                <h3 className="dashboard-card-title dashboard-card-title--sm">{integration.label}</h3>
                <p className="dashboard-copy dashboard-copy--muted">{integration.description}</p>
                <p className="dashboard-copy dashboard-copy--muted">
                  {integration.category} · {integration.providerKey}
                </p>
              </div>

              <div className="dashboard-field">
                <label className="dashboard-field-label">Anzeigename</label>
                <Input
                  value={form.displayName}
                  onChange={(event) =>
                    setForms((current) => ({
                      ...current,
                      [key]: {
                        ...current[key],
                        displayName: event.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="dashboard-field">
                <label className="dashboard-field-label">Status</label>
                <Select
                  value={form.status}
                  onChange={(event) =>
                    setForms((current) => ({
                      ...current,
                      [key]: {
                        ...current[key],
                        status: event.target.value as "connected" | "disconnected",
                      },
                    }))
                  }
                >
                  <option value="disconnected">Nicht verbunden</option>
                  <option value="connected">Verbunden</option>
                </Select>
              </div>

              {integration.configFields.map((field) => (
                <div key={field.key} className="dashboard-field">
                  <label className="dashboard-field-label">{field.label}</label>
                  <Input
                    type={field.kind === "password" ? "password" : field.kind}
                    placeholder={field.placeholder}
                    value={form.config[field.key] || ""}
                    onChange={(event) =>
                      setForms((current) => ({
                        ...current,
                        [key]: {
                          ...current[key],
                          config: {
                            ...current[key].config,
                            [field.key]: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
              ))}

              {integration.secretFields.map((field) => (
                <div key={field.key} className="dashboard-field">
                  <label className="dashboard-field-label">
                    {field.label}
                    <span className="dashboard-copy dashboard-copy--muted">
                      {" "}
                      {integration.configuredSecretCount > 0 ? "(gesetzt)" : "(noch nicht gesetzt)"}
                    </span>
                  </label>
                  <Input
                    type="password"
                    placeholder="Neuen Secret-Wert nur bei Bedarf setzen"
                    value={form.secrets[field.key] || ""}
                    onChange={(event) =>
                      setForms((current) => ({
                        ...current,
                        [key]: {
                          ...current[key],
                          secrets: {
                            ...current[key].secrets,
                            [field.key]: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="dashboard-actions">
        <Button onClick={saveIntegrations} disabled={saving}>
          {saving ? "Integrationen werden gespeichert..." : "Integrationen speichern"}
        </Button>
        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      </div>
    </div>
  );
}
