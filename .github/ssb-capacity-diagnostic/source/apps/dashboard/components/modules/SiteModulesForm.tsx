"use client";

import { useEffect, useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";

type SiteModule = {
  siteId: string;
  key: string;
  label: string;
  description: string;
  category: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
};

type SiteModuleCatalogItem = {
  key: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  defaultConfig: Record<string, unknown>;
  requiredFields: string[];
  optionalFields: string[];
};

function configString(config: Record<string, unknown> | undefined, key: string) {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}

function LeadSalesModuleFields({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (configPatch: Record<string, unknown>) => void;
}) {
  return (
    <div className="dashboard-stack dashboard-stack--sm">
      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">Hauptziel</span>
          <Select
            value={configString(config, "primaryGoal")}
            onChange={(event) =>
              onChange({
                primaryGoal: event.target.value,
              })
            }
          >
            <option value="">Bitte wählen</option>
            <option value="lead_capture">Kontaktdaten sammeln</option>
            <option value="appointment">Termin vorbereiten</option>
          </Select>
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Text</span>
          <Input
            value={configString(config, "ctaLabel")}
            onChange={(event) => onChange({ ctaLabel: event.target.value })}
            placeholder="Kontaktdaten hinterlassen"
          />
        </label>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-label">CTA-Beschreibung</span>
        <Input
          value={configString(config, "ctaDescription")}
          onChange={(event) => onChange({ ctaDescription: event.target.value })}
          placeholder="Wir melden uns schnellstmoeglich mit den naechsten Schritten."
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-label">Qualifizierungsfokus</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={configString(config, "qualificationFocus")}
          onChange={(event) => onChange({ qualificationFocus: event.target.value })}
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-label">Uebergabe-Anweisung</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={configString(config, "handoffInstruction")}
          onChange={(event) => onChange({ handoffInstruction: event.target.value })}
        />
      </label>
    </div>
  );
}

function EcommerceProductAdvisorFields({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (configPatch: Record<string, unknown>) => void;
}) {
  return (
    <div className="dashboard-stack dashboard-stack--sm">
      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">Katalogquelle</span>
          <Select
            value={configString(config, "catalogMode")}
            onChange={(event) =>
              onChange({
                catalogMode: event.target.value,
              })
            }
          >
            <option value="">Bitte wählen</option>
            <option value="knowledge_only">Wissensbasis / manuelle Inhalte</option>
            <option value="shopify_catalog">Shopify-Katalog angebunden</option>
          </Select>
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">Beratungsstil</span>
          <Select
            value={configString(config, "recommendationStyle")}
            onChange={(event) =>
              onChange({
                recommendationStyle: event.target.value,
              })
            }
          >
            <option value="">Bitte wählen</option>
            <option value="consultative">Beratend</option>
            <option value="direct">Direkt empfehlend</option>
          </Select>
        </label>
      </div>

      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Text</span>
          <Input
            value={configString(config, "ctaLabel")}
            onChange={(event) => onChange({ ctaLabel: event.target.value })}
            placeholder="Produktberatung anfragen"
          />
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Beschreibung</span>
          <Input
            value={configString(config, "ctaDescription")}
            onChange={(event) => onChange({ ctaDescription: event.target.value })}
            placeholder="Wir helfen bei Auswahl, Sortiment oder der passenden naechsten Empfehlung."
          />
        </label>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-label">Produktlink-Anweisung</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={configString(config, "productLinkInstruction")}
          onChange={(event) => onChange({ productLinkInstruction: event.target.value })}
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-label">Fallback-Anweisung</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={configString(config, "fallbackInstruction")}
          onChange={(event) => onChange({ fallbackInstruction: event.target.value })}
        />
      </label>
    </div>
  );
}

function PropertyTicketingFields({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (configPatch: Record<string, unknown>) => void;
}) {
  return (
    <div className="dashboard-stack dashboard-stack--sm">
      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">Uebergabeweg</span>
          <Select
            value={configString(config, "intakeMode")}
            onChange={(event) =>
              onChange({
                intakeMode: event.target.value,
              })
            }
          >
            <option value="">Bitte wählen</option>
            <option value="email_handoff">Weiterleitung / E-Mail-Fallaufnahme</option>
            <option value="ticket_system">Ticket-System vorbereitet</option>
          </Select>
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">Rueckfrage-Stil</span>
          <Select
            value={configString(config, "urgencyStyle")}
            onChange={(event) =>
              onChange({
                urgencyStyle: event.target.value,
              })
            }
          >
            <option value="">Bitte wählen</option>
            <option value="structured">Strukturiert</option>
            <option value="brief">Kurz und kritisch</option>
          </Select>
        </label>
      </div>

      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Text</span>
          <Input
            value={configString(config, "ctaLabel")}
            onChange={(event) => onChange({ ctaLabel: event.target.value })}
            placeholder="Schadensmeldung aufnehmen"
          />
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Beschreibung</span>
          <Input
            value={configString(config, "ctaDescription")}
            onChange={(event) => onChange({ ctaDescription: event.target.value })}
            placeholder="Wir erfassen den Fall und leiten ihn an das zustaendige Team weiter."
          />
        </label>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-label">Vorfall-Anweisung</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={configString(config, "incidentInstruction")}
          onChange={(event) => onChange({ incidentInstruction: event.target.value })}
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-label">Uebergabe-Anweisung</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={configString(config, "handoffInstruction")}
          onChange={(event) => onChange({ handoffInstruction: event.target.value })}
        />
      </label>
    </div>
  );
}

export function SiteModulesForm({ siteId }: { siteId: string }) {
  const [modules, setModules] = useState<SiteModule[]>([]);
  const [catalog, setCatalog] = useState<SiteModuleCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [modulesRes, catalogRes] = await Promise.all([
        fetch(`/api/site-modules/${siteId}`, { cache: "no-store" }),
        fetch("/api/site-modules/catalog", { cache: "no-store" }),
      ]);
      const [modulesData, catalogData] = await Promise.all([
        modulesRes.json().catch(() => []),
        catalogRes.json().catch(() => []),
      ]);

      if (!modulesRes.ok) {
        setError(modulesData?.message || "Funktionen konnten nicht geladen werden.");
        setLoading(false);
        return;
      }

      if (!catalogRes.ok) {
        setError(catalogData?.message || "Funktionskatalog konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      setModules(Array.isArray(modulesData) ? modulesData : []);
      setCatalog(Array.isArray(catalogData) ? catalogData : []);
      setLoading(false);
    }

    load();
  }, [siteId]);

  function updateModuleConfig(moduleKey: string, configPatch: Record<string, unknown>) {
    setModules((current) =>
      current.map((entry) =>
        entry.key === moduleKey
          ? {
              ...entry,
              config: {
                ...(entry.config || {}),
                ...configPatch,
              },
            }
          : entry,
      ),
    );
  }

  async function saveModules() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/site-modules/${siteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modules: modules.map((module) => ({
            key: module.key,
            isEnabled: module.isEnabled,
            config: module.config || {},
          })),
        }),
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        setError(data?.message || "Funktionen konnten nicht gespeichert werden.");
        return;
      }

      setModules(Array.isArray(data) ? data : []);
      setMessage("Funktionen gespeichert.");
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
        <h2 className="dashboard-card-title">Aktive Funktionen</h2>
        <p className="dashboard-copy">
          Hier legst du fest, welche Branchen- und Automations-Bausteine fuer diesen Kunden
          grundsaetzlich aktiv sein sollen.
        </p>
      </div>

      <div className="dashboard-stack dashboard-stack--sm">
        {modules.map((module) => {
          const catalogItem = catalog.find((entry) => entry.key === module.key);
          const label = catalogItem?.label || module.label;
          const description = catalogItem?.description || module.description;
          const category = catalogItem?.category || module.category;

          return (
            <div key={module.key} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <label className="dashboard-checkbox">
                <input
                  type="checkbox"
                  checked={module.isEnabled}
                  onChange={(event) =>
                    setModules((current) =>
                      current.map((entry) =>
                        entry.key === module.key
                          ? { ...entry, isEnabled: event.target.checked }
                          : entry,
                      ),
                    )
                  }
                />
                <span>
                  <strong>{label}</strong>
                  <br />
                  <span className="dashboard-copy dashboard-copy--muted">{description}</span>
                  <br />
                  <span className="dashboard-mono dashboard-copy--muted">
                    {category} · {module.key}
                  </span>
                </span>
              </label>

              {module.key === "lead-sales" && module.isEnabled ? (
                <LeadSalesModuleFields
                  config={module.config || {}}
                  onChange={(configPatch) => updateModuleConfig(module.key, configPatch)}
                />
              ) : null}

              {module.key === "ecommerce-product-advisor" && module.isEnabled ? (
                <EcommerceProductAdvisorFields
                  config={module.config || {}}
                  onChange={(configPatch) => updateModuleConfig(module.key, configPatch)}
                />
              ) : null}

              {module.key === "property-ticketing" && module.isEnabled ? (
                <PropertyTicketingFields
                  config={module.config || {}}
                  onChange={(configPatch) => updateModuleConfig(module.key, configPatch)}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="dashboard-actions">
        <Button onClick={saveModules} disabled={saving}>
          {saving ? "Funktionen werden gespeichert..." : "Funktionen speichern"}
        </Button>
        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      </div>
    </div>
  );
}
