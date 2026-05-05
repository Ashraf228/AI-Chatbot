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

type LeadSalesModuleConfig = {
  primaryGoal: "lead_capture" | "appointment";
  ctaLabel: string;
  ctaDescription: string;
  qualificationFocus: string;
  handoffInstruction: string;
};

type EcommerceProductAdvisorModuleConfig = {
  catalogMode: "knowledge_only" | "shopify_catalog";
  recommendationStyle: "consultative" | "direct";
  ctaLabel: string;
  ctaDescription: string;
  productLinkInstruction: string;
  fallbackInstruction: string;
};

type PropertyTicketingModuleConfig = {
  intakeMode: "email_handoff" | "ticket_system";
  urgencyStyle: "structured" | "brief";
  ctaLabel: string;
  ctaDescription: string;
  incidentInstruction: string;
  handoffInstruction: string;
};

const DEFAULT_LEAD_SALES_CONFIG: LeadSalesModuleConfig = {
  primaryGoal: "lead_capture",
  ctaLabel: "Kontaktdaten hinterlassen",
  ctaDescription: "Wir melden uns schnellstmoeglich mit den naechsten Schritten.",
  qualificationFocus: "Verstehe Bedarf, Einsatzbereich und Dringlichkeit in wenigen Rueckfragen.",
  handoffInstruction:
    "Fuehre sichtbar Richtung Kontakt, Termin oder strukturierte Datenerfassung, sobald der Bedarf klar ist.",
};

const DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_CONFIG: EcommerceProductAdvisorModuleConfig = {
  catalogMode: "knowledge_only",
  recommendationStyle: "consultative",
  ctaLabel: "Produktberatung anfragen",
  ctaDescription:
    "Wir helfen bei Auswahl, Sortiment oder der passenden naechsten Empfehlung.",
  productLinkInstruction:
    "Verweise auf konkrete Produkte, Kategorien oder Kollektionen, sobald verifizierbare Links oder Daten verfuegbar sind.",
  fallbackInstruction:
    "Wenn konkrete Produktdaten fehlen, bleibe transparent, stelle eine kurze Rueckfrage und fuehre bei Bedarf in eine persoenliche Beratung.",
};

const DEFAULT_PROPERTY_TICKETING_CONFIG: PropertyTicketingModuleConfig = {
  intakeMode: "email_handoff",
  urgencyStyle: "structured",
  ctaLabel: "Schadensmeldung aufnehmen",
  ctaDescription: "Wir erfassen den Fall und leiten ihn an das zustaendige Team weiter.",
  incidentInstruction:
    "Klaere Problem, Ort, Betroffenheit und Dringlichkeit in einer klaren Reihenfolge.",
  handoffInstruction:
    "Fuehre nach einer kurzen Qualifizierung sichtbar in die Fallaufnahme oder Weiterleitung.",
};

function normalizeLeadSalesConfig(config: Record<string, unknown> | undefined): LeadSalesModuleConfig {
  return {
    primaryGoal: config?.primaryGoal === "appointment" ? "appointment" : DEFAULT_LEAD_SALES_CONFIG.primaryGoal,
    ctaLabel:
      typeof config?.ctaLabel === "string" && config.ctaLabel.trim()
        ? config.ctaLabel
        : DEFAULT_LEAD_SALES_CONFIG.ctaLabel,
    ctaDescription:
      typeof config?.ctaDescription === "string" && config.ctaDescription.trim()
        ? config.ctaDescription
        : DEFAULT_LEAD_SALES_CONFIG.ctaDescription,
    qualificationFocus:
      typeof config?.qualificationFocus === "string" && config.qualificationFocus.trim()
        ? config.qualificationFocus
        : DEFAULT_LEAD_SALES_CONFIG.qualificationFocus,
    handoffInstruction:
      typeof config?.handoffInstruction === "string" && config.handoffInstruction.trim()
        ? config.handoffInstruction
        : DEFAULT_LEAD_SALES_CONFIG.handoffInstruction,
  };
}

function normalizeEcommerceProductAdvisorConfig(
  config: Record<string, unknown> | undefined,
): EcommerceProductAdvisorModuleConfig {
  return {
    catalogMode:
      config?.catalogMode === "shopify_catalog"
        ? "shopify_catalog"
        : DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_CONFIG.catalogMode,
    recommendationStyle:
      config?.recommendationStyle === "direct"
        ? "direct"
        : DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_CONFIG.recommendationStyle,
    ctaLabel:
      typeof config?.ctaLabel === "string" && config.ctaLabel.trim()
        ? config.ctaLabel
        : DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_CONFIG.ctaLabel,
    ctaDescription:
      typeof config?.ctaDescription === "string" && config.ctaDescription.trim()
        ? config.ctaDescription
        : DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_CONFIG.ctaDescription,
    productLinkInstruction:
      typeof config?.productLinkInstruction === "string" && config.productLinkInstruction.trim()
        ? config.productLinkInstruction
        : DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_CONFIG.productLinkInstruction,
    fallbackInstruction:
      typeof config?.fallbackInstruction === "string" && config.fallbackInstruction.trim()
        ? config.fallbackInstruction
        : DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_CONFIG.fallbackInstruction,
  };
}

function normalizePropertyTicketingConfig(
  config: Record<string, unknown> | undefined,
): PropertyTicketingModuleConfig {
  return {
    intakeMode:
      config?.intakeMode === "ticket_system"
        ? "ticket_system"
        : DEFAULT_PROPERTY_TICKETING_CONFIG.intakeMode,
    urgencyStyle:
      config?.urgencyStyle === "brief"
        ? "brief"
        : DEFAULT_PROPERTY_TICKETING_CONFIG.urgencyStyle,
    ctaLabel:
      typeof config?.ctaLabel === "string" && config.ctaLabel.trim()
        ? config.ctaLabel
        : DEFAULT_PROPERTY_TICKETING_CONFIG.ctaLabel,
    ctaDescription:
      typeof config?.ctaDescription === "string" && config.ctaDescription.trim()
        ? config.ctaDescription
        : DEFAULT_PROPERTY_TICKETING_CONFIG.ctaDescription,
    incidentInstruction:
      typeof config?.incidentInstruction === "string" && config.incidentInstruction.trim()
        ? config.incidentInstruction
        : DEFAULT_PROPERTY_TICKETING_CONFIG.incidentInstruction,
    handoffInstruction:
      typeof config?.handoffInstruction === "string" && config.handoffInstruction.trim()
        ? config.handoffInstruction
        : DEFAULT_PROPERTY_TICKETING_CONFIG.handoffInstruction,
  };
}

function LeadSalesModuleFields({
  config,
  onChange,
}: {
  config: LeadSalesModuleConfig;
  onChange: (configPatch: Partial<LeadSalesModuleConfig>) => void;
}) {
  return (
    <div className="dashboard-stack dashboard-stack--sm">
      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">Hauptziel</span>
          <Select
            value={config.primaryGoal}
            onChange={(event) =>
              onChange({
                primaryGoal: event.target.value as LeadSalesModuleConfig["primaryGoal"],
              })
            }
          >
            <option value="lead_capture">Kontaktdaten sammeln</option>
            <option value="appointment">Termin vorbereiten</option>
          </Select>
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Text</span>
          <Input
            value={config.ctaLabel}
            onChange={(event) => onChange({ ctaLabel: event.target.value })}
            placeholder="Kontaktdaten hinterlassen"
          />
        </label>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-label">CTA-Beschreibung</span>
        <Input
          value={config.ctaDescription}
          onChange={(event) => onChange({ ctaDescription: event.target.value })}
          placeholder="Wir melden uns schnellstmoeglich mit den naechsten Schritten."
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-label">Qualifizierungsfokus</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={config.qualificationFocus}
          onChange={(event) => onChange({ qualificationFocus: event.target.value })}
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-label">Uebergabe-Anweisung</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={config.handoffInstruction}
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
  config: EcommerceProductAdvisorModuleConfig;
  onChange: (configPatch: Partial<EcommerceProductAdvisorModuleConfig>) => void;
}) {
  return (
    <div className="dashboard-stack dashboard-stack--sm">
      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">Katalogquelle</span>
          <Select
            value={config.catalogMode}
            onChange={(event) =>
              onChange({
                catalogMode: event.target.value as EcommerceProductAdvisorModuleConfig["catalogMode"],
              })
            }
          >
            <option value="knowledge_only">Wissensbasis / manuelle Inhalte</option>
            <option value="shopify_catalog">Shopify-Katalog angebunden</option>
          </Select>
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">Beratungsstil</span>
          <Select
            value={config.recommendationStyle}
            onChange={(event) =>
              onChange({
                recommendationStyle:
                  event.target.value as EcommerceProductAdvisorModuleConfig["recommendationStyle"],
              })
            }
          >
            <option value="consultative">Beratend</option>
            <option value="direct">Direkt empfehlend</option>
          </Select>
        </label>
      </div>

      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Text</span>
          <Input
            value={config.ctaLabel}
            onChange={(event) => onChange({ ctaLabel: event.target.value })}
            placeholder="Produktberatung anfragen"
          />
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Beschreibung</span>
          <Input
            value={config.ctaDescription}
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
          value={config.productLinkInstruction}
          onChange={(event) => onChange({ productLinkInstruction: event.target.value })}
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-label">Fallback-Anweisung</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={config.fallbackInstruction}
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
  config: PropertyTicketingModuleConfig;
  onChange: (configPatch: Partial<PropertyTicketingModuleConfig>) => void;
}) {
  return (
    <div className="dashboard-stack dashboard-stack--sm">
      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">Uebergabeweg</span>
          <Select
            value={config.intakeMode}
            onChange={(event) =>
              onChange({
                intakeMode: event.target.value as PropertyTicketingModuleConfig["intakeMode"],
              })
            }
          >
            <option value="email_handoff">Weiterleitung / E-Mail-Fallaufnahme</option>
            <option value="ticket_system">Ticket-System vorbereitet</option>
          </Select>
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">Rueckfrage-Stil</span>
          <Select
            value={config.urgencyStyle}
            onChange={(event) =>
              onChange({
                urgencyStyle: event.target.value as PropertyTicketingModuleConfig["urgencyStyle"],
              })
            }
          >
            <option value="structured">Strukturiert</option>
            <option value="brief">Kurz und kritisch</option>
          </Select>
        </label>
      </div>

      <div className="dashboard-grid dashboard-grid--2">
        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Text</span>
          <Input
            value={config.ctaLabel}
            onChange={(event) => onChange({ ctaLabel: event.target.value })}
            placeholder="Schadensmeldung aufnehmen"
          />
        </label>

        <label className="dashboard-field">
          <span className="dashboard-label">CTA-Beschreibung</span>
          <Input
            value={config.ctaDescription}
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
          value={config.incidentInstruction}
          onChange={(event) => onChange({ incidentInstruction: event.target.value })}
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-label">Uebergabe-Anweisung</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={config.handoffInstruction}
          onChange={(event) => onChange({ handoffInstruction: event.target.value })}
        />
      </label>
    </div>
  );
}

export function SiteModulesForm({ siteId }: { siteId: string }) {
  const [modules, setModules] = useState<SiteModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/site-modules/${siteId}`, { cache: "no-store" });
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        setError(data?.message || "Module konnten nicht geladen werden.");
        setLoading(false);
        return;
      }

      setModules(Array.isArray(data) ? data : []);
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
        setError(data?.message || "Module konnten nicht gespeichert werden.");
        return;
      }

      setModules(Array.isArray(data) ? data : []);
      setMessage("Module gespeichert.");
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
        <h2 className="dashboard-card-title">Aktive Module</h2>
        <p className="dashboard-copy">
          Hier legst du fest, welche Branchen- und Agenten-Bausteine fuer diesen Kunden
          grundsaetzlich aktiv sein sollen.
        </p>
      </div>

      <div className="dashboard-stack dashboard-stack--sm">
        {modules.map((module) => (
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
                <strong>{module.label}</strong>
                <br />
                <span className="dashboard-copy dashboard-copy--muted">{module.description}</span>
                <br />
                <span className="dashboard-mono dashboard-copy--muted">
                  {module.category} · {module.key}
                </span>
              </span>
            </label>

            {module.key === "lead-sales" && module.isEnabled ? (
              <LeadSalesModuleFields
                config={normalizeLeadSalesConfig(module.config)}
                onChange={(configPatch) => updateModuleConfig(module.key, configPatch)}
              />
            ) : null}

            {module.key === "ecommerce-product-advisor" && module.isEnabled ? (
              <EcommerceProductAdvisorFields
                config={normalizeEcommerceProductAdvisorConfig(module.config)}
                onChange={(configPatch) => updateModuleConfig(module.key, configPatch)}
              />
            ) : null}

            {module.key === "property-ticketing" && module.isEnabled ? (
              <PropertyTicketingFields
                config={normalizePropertyTicketingConfig(module.config)}
                onChange={(configPatch) => updateModuleConfig(module.key, configPatch)}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="dashboard-actions">
        <Button onClick={saveModules} disabled={saving}>
          {saving ? "Module werden gespeichert..." : "Module speichern"}
        </Button>
        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      </div>
    </div>
  );
}
