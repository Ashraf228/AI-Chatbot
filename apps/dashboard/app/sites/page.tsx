"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "../../components/layout/Topbar";
import { Button } from "../../components/shared/Button";
import { EmptyState } from "../../components/shared/EmptyState";
import { ErrorState } from "../../components/shared/ErrorState";
import { Select } from "../../components/shared/Select";
import { EmbedSnippetCard } from "../../components/sites/EmbedSnippetCard";
import { SiteForm } from "../../components/sites/SiteForm";

type Site = {
  id: string;
  tenant_id: string | null;
  name: string;
  allowed_domains: string[];
  public_key: string | null;
};

function resolveLoaderUrl() {
  const configured = process.env.NEXT_PUBLIC_WIDGET_LOADER_URL?.trim();
  const hasUsableConfiguredUrl =
    configured && !configured.includes("localhost") && !configured.includes("127.0.0.1");

  if (hasUsableConfiguredUrl) {
    return configured;
  }

  if (typeof window === "undefined") {
    return configured || "http://localhost:8080/loader.js";
  }

  const { protocol, hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return configured || "http://localhost:8080/loader.js";
  }

  const widgetHost = hostname.startsWith("app.")
    ? hostname.replace(/^app\./, "widget.")
    : `widget.${hostname}`;

  return `${protocol}//${widgetHost}/loader.js`;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [form, setForm] = useState({
    id: "",
    tenantId: "t_default",
    name: "",
    domain: "localhost",
  });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [loaderUrl, setLoaderUrl] = useState(
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js"
  );

  useEffect(() => {
    setLoaderUrl(resolveLoaderUrl());
  }, []);

  async function loadSites() {
    setErr(null);

    const r = await fetch("/api/sites", { cache: "no-store" });
    const data = await r.json();

    if (!r.ok) {
      setErr(typeof data === "string" ? data : JSON.stringify(data));
      return;
    }

    const items = Array.isArray(data) ? data : [];
    setSites(items);

    if (!selectedSiteId && items.length > 0) {
      setSelectedSiteId(items[0].id);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  const embedCode = useMemo(() => {
    if (!selectedSite) return "";

    return `<script src="${loaderUrl}" data-site-key="${selectedSite.id}" defer></script>`;
  }, [loaderUrl, selectedSite]);

  useEffect(() => {
    async function loadSelectedSiteConfig() {
      if (!selectedSiteId) {
        setSystemPrompt("");
        return;
      }

      setPromptLoading(true);

      try {
        const r = await fetch(`/api/widget/sites/${selectedSiteId}`, { cache: "no-store" });
        const data = await r.json().catch(() => ({}));

        if (!r.ok) {
          setErr(data?.message || "System Prompt konnte nicht geladen werden.");
          setSystemPrompt("");
          return;
        }

        setSystemPrompt(data.systemPrompt || "");
      } finally {
        setPromptLoading(false);
      }
    }

    loadSelectedSiteConfig();
  }, [selectedSiteId]);

  async function createSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const body = {
      id: form.id.trim(),
      tenantId: form.tenantId.trim(),
      name: form.name.trim(),
      allowedDomains: [form.domain.trim()].filter(Boolean),
      config: {},
    };

    const r = await fetch("/api/sites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      setErr(typeof data === "string" ? data : JSON.stringify(data));
      return;
    }

    setMsg("Site erfolgreich erstellt.");
    setForm({
      id: "",
      tenantId: "t_default",
      name: "",
      domain: "localhost",
    });

    await loadSites();

    if (data?.id) {
      setSelectedSiteId(data.id);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setErr(null);

      setTimeout(() => {
        setCopied(null);
      }, 2000);
    } catch {
      setErr(`${label} konnte nicht kopiert werden.`);
    }
  }

  async function saveSystemPrompt() {
    if (!selectedSite) return;

    setPromptSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const r = await fetch(`/api/widget/config/${selectedSite.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt,
        }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setErr(data?.message || "System Prompt konnte nicht gespeichert werden.");
        return;
      }

      setSystemPrompt(data.systemPrompt || systemPrompt);
      setMsg("System Prompt gespeichert.");
    } finally {
      setPromptSaving(false);
    }
  }

  return (
    <div>
      <Topbar title="Sites" />
      <div className="dashboard-page dashboard-page--wide">
        <div className="dashboard-grid dashboard-grid--split">
          <div>
            <h2 className="dashboard-section-title">Neue Site anlegen</h2>

            <SiteForm form={form} onChange={setForm} onSubmit={createSite} />

            {err && <ErrorState message={err} />}

            {msg && <p className="dashboard-status dashboard-status--success">{msg}</p>}
          </div>

          <div>
            <h2 className="dashboard-section-title">Vorhandene Sites</h2>

            <div className="dashboard-card">
              {sites.length === 0 ? (
                <EmptyState title="Keine Sites vorhanden." />
              ) : (
                <>
                  <Select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    style={{ marginBottom: 16 }}
                  >
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.id} — {site.name}
                      </option>
                    ))}
                  </Select>

                  {selectedSite && (
                    <div className="dashboard-stack dashboard-stack--sm">
                      <InfoRow label="Name" value={selectedSite.name} />
                      <InfoRow label="Tenant" value={selectedSite.tenant_id || "-"} />
                      <InfoRow
                        label="Domains"
                        value={selectedSite.allowed_domains.join(", ") || "-"}
                      />
                      <InfoRow
                        label="Public Key"
                        value={selectedSite.public_key || "nicht vorhanden"}
                      />

                      <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => {
                            window.location.href = `/sites/${selectedSite.id}/branding`;
                          }}
                        >
                          Site öffnen
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            window.location.href = `/sites/${selectedSite.id}/widget`;
                          }}
                        >
                          Widget konfigurieren
                        </Button>
                      </div>

                      <EmbedSnippetCard
                        loaderUrl={loaderUrl}
                        siteId={selectedSite.id}
                        publicKey={selectedSite.public_key}
                        embedCode={embedCode}
                        copied={copied}
                        onCopy={copyText}
                      />

                      <div className="dashboard-card dashboard-stack dashboard-stack--sm">
                        <div>
                          <h3 className="dashboard-card-title dashboard-card-title--sm">
                            Kunden-Systemprompt
                          </h3>
                          <p className="dashboard-copy dashboard-copy--muted">
                            Dieser Prompt gilt nur für den ausgewählten Kunden. Leer lassen =
                            globaler Standardprompt.
                          </p>
                        </div>

                        <textarea
                          className="dashboard-textarea dashboard-mono"
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          placeholder="Optionaler kundenspezifischer Systemprompt"
                          style={{ minHeight: 220 }}
                          disabled={promptLoading || promptSaving}
                        />

                        <Button
                          type="button"
                          variant="secondary"
                          onClick={saveSystemPrompt}
                          disabled={promptLoading || promptSaving}
                        >
                          {promptLoading
                            ? "Lade..."
                            : promptSaving
                              ? "Speichert..."
                              : "System Prompt speichern"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-info-row">
      <strong>{label}</strong>
      <span className="dashboard-breakword">{value}</span>
    </div>
  );
}
