"use client";

import { useEffect, useState } from "react";
import { CustomerStatusBadge } from "../../components/customer/CustomerStatusBadge";
import { Topbar } from "../../components/layout/Topbar";
import { Button } from "../../components/shared/Button";
import { EmptyState } from "../../components/shared/EmptyState";
import { ErrorState } from "../../components/shared/ErrorState";
import { Input } from "../../components/shared/Input";
import { Select } from "../../components/shared/Select";
import { SiteForm } from "../../components/sites/SiteForm";
import { type IndustryTemplate, templatesByKey } from "../../lib/industry-templates";
import { encodeSiteId } from "../../lib/site-id";
import { buildUniversalSiteConfig } from "../../lib/site-create-config";
import type { BusinessSiteMetric } from "../../lib/business-analytics";
import { formatNumber, formatPercent } from "../../lib/business-analytics";
import {
  mapOverallStatusToTone,
  type CustomerOverallStatus,
} from "../../components/customer/customer-status";

type Site = {
  id: string;
  site_key: string;
  tenant_id: string | null;
  name: string;
  allowed_domains: string[];
  public_key: string | null;
  setupStatus?: SiteStatusSummary;
};

type SiteStatusSummary = {
  status: CustomerOverallStatus;
  industry: string;
  setupGoal: string;
};

type Tenant = {
  id: string;
  name: string;
};

type LimitCheck = {
  key: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
};

type BillingLimitOverview = {
  plan?: {
    code: string;
    name: string;
  } | null;
  checks?: LimitCheck[];
};

const DEFAULT_TENANT = {
  id: "t-default",
  name: "Interner Mandant",
};

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [siteStatusById, setSiteStatusById] = useState<Record<string, SiteStatusSummary>>({});
  const [siteMetricsById, setSiteMetricsById] = useState<Record<string, BusinessSiteMetric>>({});
  const [form, setForm] = useState({
    siteKey: "",
    tenantId: "",
    name: "",
    domain: "localhost",
    businessDescription: "",
    targetUsers: "",
    assistantRole: "customer_service",
    assistantRoleCustom: "",
    enabledTasks: ["answer_questions"],
    industry: "",
    botType: "universal-assistant",
    leadNotificationEmail: "",
  });
  const [tenantForm, setTenantForm] = useState({
    id: "",
    name: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [limitOverview, setLimitOverview] = useState<BillingLimitOverview | null>(null);
  const [tenantSaving, setTenantSaving] = useState(false);
  const templateLabels = templatesByKey(templates);
  const maxSitesLimit = limitOverview?.checks?.find((check) => check.key === "maxSites") || null;
  const isSiteLimitReached =
    typeof maxSitesLimit?.limit === "number" && maxSitesLimit.used >= maxSitesLimit.limit;
  const maxSitesLimitMessage = isSiteLimitReached
    ? `Dein aktueller Plan erlaubt maximal ${maxSitesLimit.limit} Kunden. Upgrade erforderlich.`
    : null;

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
    setSiteStatusById(
      Object.fromEntries(
        items
          .filter((site) => site.setupStatus)
          .map((site) => [
            site.id,
            {
              status: site.setupStatus!.status,
              industry: site.setupStatus!.industry,
              setupGoal: site.setupStatus!.setupGoal,
            },
          ]),
      ),
    );
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
      const defaultTenant = items.find((tenant) => tenant.id === DEFAULT_TENANT.id);
      setForm((current) => ({
        ...current,
        tenantId:
          current.tenantId && items.some((tenant) => tenant.id === current.tenantId)
            ? current.tenantId
            : defaultTenant?.id || items[0].id,
      }));
    } else {
      setForm((current) => ({
        ...current,
        tenantId: "",
      }));
    }
  }

  useEffect(() => {
    loadTenants();
    loadSites();
    loadTemplates();
    loadBusinessSummary();
  }, []);

  useEffect(() => {
    if (!form.tenantId) {
      setLimitOverview(null);
      return;
    }

    loadBillingLimits(form.tenantId);
  }, [form.tenantId]);

  async function loadBusinessSummary() {
    const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(data?.sites)) {
      setSiteMetricsById(
        Object.fromEntries(data.sites.map((site: BusinessSiteMetric) => [site.id, site])),
      );
    }
  }

  async function loadTemplates() {
    const response = await fetch("/api/industry-templates", { cache: "no-store" });
    const data = await response.json().catch(() => []);
    if (response.ok && Array.isArray(data)) {
      setTemplates(data);
    }
  }

  async function loadBillingLimits(tenantId: string) {
    const response = await fetch(`/api/billing/limits?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setLimitOverview(data);
      return;
    }

    setLimitOverview(null);
  }

  async function createSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (isSiteLimitReached) {
      setErr(maxSitesLimitMessage || "Dein aktueller Plan erlaubt keine weiteren Kunden. Upgrade erforderlich.");
      return;
    }

    const tenantId = await ensureTenantForCustomerCreate();
    if (!tenantId) {
      return;
    }

    const leadNotificationEmail = form.leadNotificationEmail.trim();
    if (leadNotificationEmail && !isValidEmail(leadNotificationEmail)) {
      setErr("Bitte eine gültige Übergabe-E-Mail eintragen.");
      return;
    }

    const templateMap = templatesByKey(templates);
    const selectedLegacyTemplate = form.industry ? templateMap[form.industry] : null;
    const body = {
      siteKey: form.siteKey.trim(),
      tenantId,
      name: form.name.trim(),
      allowedDomains: [form.domain.trim()].filter(Boolean),
      config: buildUniversalSiteConfig({
        customerName: form.name,
        businessDescription: form.businessDescription,
        targetUsers: form.targetUsers,
        assistantRole: form.assistantRole,
        assistantRoleCustom: form.assistantRoleCustom,
        enabledTasks: form.enabledTasks,
        industry: form.industry,
        botType: form.botType,
        leadNotificationEmail,
      }),
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
      setErr(formatApiError(data, "Kunde konnte nicht angelegt werden."));
      return;
    }

    if (data?.id) {
      const template = selectedLegacyTemplate;
      if (!template) {
        setMsg("Kunde erfolgreich angelegt. Das universelle KI-Mitarbeiter-Profil wurde vorbereitet.");
        window.location.href = `/sites/${encodeSiteId(data.id)}/setup`;
        return;
      }

      const response = await fetch(`/api/sites/${data.id}/apply-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templateId: template.key, mode: "overwrite" }),
      });

      if (!response.ok) {
        setErr("Kunde wurde angelegt, aber die Legacy-Vorlage konnte nicht vollständig angewendet werden.");
      } else {
        setMsg(`Kunde erfolgreich angelegt. Legacy-Vorlage „${template.label}“ wurde angewendet.`);
        window.location.href = `/sites/${encodeSiteId(data.id)}/setup`;
        return;
      }
    }

    setForm({
      siteKey: "",
      tenantId,
      name: "",
      domain: "localhost",
      businessDescription: "",
      targetUsers: "",
      assistantRole: "customer_service",
      assistantRoleCustom: "",
      enabledTasks: ["answer_questions"],
      industry: "",
      botType: "universal-assistant",
      leadNotificationEmail: "",
    });

    await loadSites();
  }

  async function ensureTenantForCustomerCreate() {
    const selectedTenantId = form.tenantId.trim();
    const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);

    if (selectedTenant) {
      return selectedTenant.id;
    }

    if (tenants.length > 0) {
      const fallbackTenantId = tenants[0].id;
      setForm((current) => ({ ...current, tenantId: fallbackTenantId }));
      return fallbackTenantId;
    }

    const response = await fetch("/api/tenants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(DEFAULT_TENANT),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data?.id) {
      const createdTenant = {
        id: String(data.id),
        name: String(data.name || DEFAULT_TENANT.name),
      };
      setTenants([createdTenant]);
      setForm((current) => ({ ...current, tenantId: createdTenant.id }));
      return createdTenant.id;
    }

    const refreshed = await fetch("/api/tenants", { cache: "no-store" });
    const refreshedData = await refreshed.json().catch(() => []);
    const refreshedTenants = Array.isArray(refreshedData) ? refreshedData : [];

    if (refreshed.ok && refreshedTenants.length > 0) {
      setTenants(refreshedTenants);
      setForm((current) => ({ ...current, tenantId: refreshedTenants[0].id }));
      return refreshedTenants[0].id;
    }

    setErr(
      response.status === 403
        ? "Es ist noch kein interner Mandant vorhanden. Bitte als Admin einen Mandanten anlegen."
        : formatApiError(data, "Interner Mandant konnte nicht automatisch angelegt werden."),
    );
    return null;
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
            <p className="dashboard-copy dashboard-copy--muted">
              Starte mit Kundenname, Website und einer kurzen Beschreibung. Die KI erkennt Kontext und Aufgaben später aus Wissen, Konfiguration und Gesprächsverlauf.
            </p>
            {tenants.length === 0 ? (
              <p className="dashboard-status dashboard-status--neutral">
                Beim ersten Kunden wird automatisch ein interner Standardmandant angelegt.
              </p>
            ) : null}

            <SiteForm
              form={form}
              tenantOptions={tenants}
              industryOptions={templates}
              submitDisabled={isSiteLimitReached}
              limitMessage={maxSitesLimitMessage}
              planLabel={limitOverview?.plan?.name || null}
              onChange={setForm}
              onSubmit={createSite}
            />

            <details className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm dashboard-mt-14">
              <summary className="dashboard-accordion__summary">Interne Mandantenverwaltung</summary>
              <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                Nur für interne Strukturen nötig. Für normale Kundenanlage wird dieser Bereich in der Regel nicht gebraucht.
              </p>
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
            </details>

            {err && <ErrorState message={err} />}

            {msg && <p className="dashboard-status dashboard-status--success">{msg}</p>}
          </div>

          <div>
            <h2 className="dashboard-section-title">Vorhandene Kunden</h2>

            <div className="dashboard-card dashboard-stack dashboard-stack--sm">
              {sites.length === 0 ? (
                <EmptyState title="Keine Kunden vorhanden." />
              ) : (
                sites.map((site) => {
                  const status = siteStatusById[site.id];
                  const metrics = siteMetricsById[site.id];

                  return (
                    <div key={site.id} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
                      <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
                        <div>
                          <strong>{site.name}</strong>
                          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                            {site.allowed_domains.join(", ") || "Keine Domain hinterlegt"}
                          </p>
                        </div>
                        <CustomerStatusBadge
                          status={status ? mapOverallStatusToTone(status.status) : "pending"}
                          label={status?.status || "Wird geladen"}
                        />
                      </div>
                      {status?.industry ? (
                        <InfoRow label="Legacy-Profil" value={templateLabels[status.industry]?.label || status.industry} />
                      ) : null}
                      {status?.setupGoal ? <InfoRow label="Bot-Ziel" value={formatGoal(status.setupGoal)} /> : null}
                      <div className="dashboard-grid dashboard-grid--metrics-4 dashboard-grid--compact">
                        <MiniMetric label="Chats 7 Tage" value={formatNumber(metrics?.conversations7d || 0)} />
                        <MiniMetric label="Anfragen 7 Tage" value={formatNumber(metrics?.leads7d || 0)} />
                        <MiniMetric label="Conversion" value={formatPercent(metrics?.conversionRate || 0)} />
                        <MiniMetric label="Widget" value={metrics?.isActive ? "Aktiv" : "Inaktiv"} />
                      </div>
                      <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => {
                            window.location.href = `/sites/${encodeSiteId(site.id)}`;
                          }}
                        >
                          Übersicht öffnen
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            window.location.href = `/sites/${encodeSiteId(site.id)}/analytics`;
                          }}
                        >
                          Analytics ansehen
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            window.location.href = `/sites/${encodeSiteId(site.id)}/embedding`;
                          }}
                        >
                          Einbindung öffnen
                        </Button>
                      </div>
                    </div>
                  );
                })
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-card dashboard-card--soft">
      <strong>{value}</strong>
      <p className="dashboard-copy dashboard-copy--muted dashboard-copy--xs dashboard-no-margin-bottom">
        {label}
      </p>
    </div>
  );
}

function formatGoal(goal: string) {
  if (goal === "lead_capture") {
    return "Leads sammeln";
  }

  if (goal === "support") {
    return "Support beantworten";
  }

  if (goal === "product_advice") {
    return "Produkte empfehlen";
  }

  if (goal === "appointments") {
    return "Termine vorbereiten";
  }

  return goal;
}

function formatApiError(data: unknown, fallback: string) {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object" && "message" in data) {
    const message = String((data as { message?: unknown }).message || "");
    const code = "code" in data ? String((data as { code?: unknown }).code || "") : "";
    const limit = "limit" in data && typeof (data as { limit?: unknown }).limit === "object"
      ? (data as { limit?: { key?: unknown; limit?: unknown } }).limit
      : null;

    if (message === "tenantId not found") {
      return "Der interne Mandant wurde nicht gefunden. Bitte versuche es erneut oder lege einen Mandanten manuell an.";
    }

    if (code === "limit_exceeded" && limit?.key === "maxSites" && typeof limit.limit === "number") {
      return `Dein aktueller Plan erlaubt maximal ${limit.limit} Kunden. Upgrade erforderlich.`;
    }

    if (message) {
      return message;
    }
  }

  return fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
