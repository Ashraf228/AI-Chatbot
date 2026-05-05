"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "../../components/layout/Topbar";
import { Button } from "../../components/shared/Button";
import { EmptyState } from "../../components/shared/EmptyState";
import { ErrorState } from "../../components/shared/ErrorState";
import { Input } from "../../components/shared/Input";
import { Select } from "../../components/shared/Select";
import { SiteForm } from "../../components/sites/SiteForm";
import { encodeSiteId } from "../../lib/site-id";

type Site = {
  id: string;
  site_key: string;
  tenant_id: string | null;
  name: string;
  allowed_domains: string[];
  public_key: string | null;
};

type Tenant = {
  id: string;
  name: string;
};

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [form, setForm] = useState({
    siteKey: "",
    tenantId: "t_default",
    name: "",
    domain: "localhost",
  });
  const [tenantForm, setTenantForm] = useState({
    id: "",
    name: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tenantSaving, setTenantSaving] = useState(false);

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

  async function loadTenants() {
    const r = await fetch("/api/tenants", { cache: "no-store" });
    const data = await r.json().catch(() => []);

    if (!r.ok) {
      setErr(data?.message || "Mandanten konnten nicht geladen werden.");
      return;
    }

    const items = Array.isArray(data) ? data : [];
    setTenants(items);

    if (items.length > 0) {
      setForm((current) => ({
        ...current,
        tenantId:
          current.tenantId && items.some((tenant) => tenant.id === current.tenantId)
            ? current.tenantId
            : items[0].id,
      }));
    }
  }

  useEffect(() => {
    loadTenants();
    loadSites();
  }, []);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  async function createSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const body = {
      siteKey: form.siteKey.trim(),
      tenantId: form.tenantId.trim(),
      name: form.name.trim(),
      allowedDomains: [form.domain.trim()].filter(Boolean),
      config: {},
    };

    if (!body.tenantId) {
      setErr("Bitte zuerst einen Mandanten auswählen oder anlegen.");
      return;
    }

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

    setMsg("Kunde erfolgreich angelegt.");
    setForm({
      siteKey: "",
      tenantId: "t_default",
      name: "",
      domain: "localhost",
    });

    await loadSites();

    if (data?.id) {
      setSelectedSiteId(data.id);
    }
  }

  async function createTenant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTenantSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const r = await fetch("/api/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: tenantForm.id.trim(),
          name: tenantForm.name.trim() || undefined,
        }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setErr(data?.message || "Mandant konnte nicht angelegt werden.");
        return;
      }

      setTenantForm({ id: "", name: "" });
      setMsg("Mandant erfolgreich angelegt.");
      await loadTenants();
      setForm((current) => ({
        ...current,
        tenantId: data.id || current.tenantId,
      }));
    } finally {
      setTenantSaving(false);
    }
  }

  return (
    <div>
      <Topbar title="Kunden" />
      <div className="dashboard-page dashboard-page--wide">
        <div className="dashboard-grid dashboard-grid--split">
          <div>
            <h2 className="dashboard-section-title">Neuen Kunden anlegen</h2>

            <SiteForm
              form={form}
              tenantOptions={tenants}
              onChange={setForm}
              onSubmit={createSite}
            />

            <div className="dashboard-card dashboard-stack dashboard-stack--sm" style={{ marginTop: 16 }}>
              <h3 className="dashboard-card-title">Neuen Mandanten anlegen</h3>
              <div className="dashboard-field">
                <label className="dashboard-field-label" htmlFor="tenant-create-id">
                  Mandanten-ID
                </label>
                <Input
                  id="tenant-create-id"
                  placeholder="hausverwaltung-nord"
                  value={tenantForm.id}
                  onChange={(event) =>
                    setTenantForm((current) => ({ ...current, id: event.target.value }))
                  }
                />
              </div>
              <div className="dashboard-field">
                <label className="dashboard-field-label" htmlFor="tenant-create-name">
                  Anzeigename
                </label>
                <Input
                  id="tenant-create-name"
                  placeholder="Hausverwaltung Nord"
                  value={tenantForm.name}
                  onChange={(event) =>
                    setTenantForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <form onSubmit={createTenant}>
                <Button type="submit" disabled={tenantSaving}>
                  {tenantSaving ? "Mandant wird angelegt..." : "Mandant anlegen"}
                </Button>
              </form>
            </div>

            {err && <ErrorState message={err} />}

            {msg && <p className="dashboard-status dashboard-status--success">{msg}</p>}
          </div>

          <div>
            <h2 className="dashboard-section-title">Vorhandene Kunden</h2>

            <div className="dashboard-card">
              {sites.length === 0 ? (
                <EmptyState title="Keine Kunden vorhanden." />
              ) : (
                <>
                  <Select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    style={{ marginBottom: 16 }}
                  >
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} — {site.site_key}
                      </option>
                    ))}
                  </Select>

                  {selectedSite && (
                    <div className="dashboard-stack dashboard-stack--sm">
                      <p className="dashboard-copy dashboard-copy--muted">
                        Die Einrichtung passiert im Kundenbereich. Die globale Kundenliste dient nur
                        zum Anlegen, Auswählen und Öffnen.
                      </p>

                      <InfoRow label="Name" value={selectedSite.name} />
                      <InfoRow label="Einbindungsschlüssel" value={selectedSite.site_key} />
                      <InfoRow
                        label="Domains"
                        value={selectedSite.allowed_domains.join(", ") || "-"}
                      />

                      <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => {
                            window.location.href = `/sites/${encodeSiteId(selectedSite.id)}`;
                          }}
                        >
                          Kunde öffnen
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            window.location.href = `/sites/${encodeSiteId(selectedSite.id)}/knowledge`;
                          }}
                        >
                          Wissen öffnen
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            window.location.href = `/sites/${encodeSiteId(selectedSite.id)}/widget`;
                          }}
                        >
                          Verhalten öffnen
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
