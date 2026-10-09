"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { encodeSiteId } from "../../lib/site-id";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";

type ReadinessStatus = "ready" | "warning" | "not_ready";

type ReadinessAction = {
  key: string;
  label: string;
  description?: string;
  href?: string;
  severity?: "primary" | "secondary" | "warning";
  disabled?: boolean;
};

type ItSupportReadiness = {
  status: ReadinessStatus;
  label: string;
  summary: string;
  checks: Record<string, boolean>;
  missing: string[];
  warnings: string[];
  actions: ReadinessAction[];
  details: {
    importedItKnowledgeTemplateCount: number;
    availableItKnowledgeTemplateCount: number;
    activeKnowledgeSourceCount: number;
    ticketWebhook: {
      enabled: boolean;
      forwardingConfigured: boolean;
      hasSigningSecret: boolean;
      lastTestStatus: string | null;
      lastTestAt: string | null;
    };
  };
};

const CHECK_LABELS: Array<{ key: string; label: string; description: string }> = [
  {
    key: "itSupportEnabled",
    label: "IT-Support Modul aktiv",
    description: "Der dedizierte IT-Support-Agent ist für diese Site aktiviert.",
  },
  {
    key: "knowledgeFaqEnabled",
    label: "Knowledge-FAQ aktiv",
    description: "Der Agent kann Wissensquellen für Antworten verwenden.",
  },
  {
    key: "activeKnowledgeSourcesAvailable",
    label: "IT-Wissensbasis vorhanden",
    description: "Mindestens eine aktive Wissensquelle ist bereit.",
  },
  {
    key: "itKnowledgeTemplatesImported",
    label: "IT-Templates importiert",
    description: "Vorbereitete IT-Support-Templates wurden in die Wissensbasis übernommen.",
  },
  {
    key: "requiredTicketFieldsValid",
    label: "Pflichtfelder gültig",
    description: "Die Ticketfelder sind technisch gültig konfiguriert.",
  },
  {
    key: "ticketConfirmationRequired",
    label: "Ticketbestätigung aktiv",
    description: "Der Nutzer muss vor Ticketerstellung bestätigen.",
  },
  {
    key: "escalationKeywordsConfigured",
    label: "Eskalationsregeln vorhanden",
    description: "Kritische IT-Fälle können gezielter erkannt werden.",
  },
  {
    key: "ticketForwardingConfigured",
    label: "Ticket-Weiterleitung konfiguriert",
    description: "ticket.created wird an die konfigurierte Webhook-Queue übergeben.",
  },
];

function statusClass(status: ReadinessStatus) {
  if (status === "ready") return "dashboard-status dashboard-status--success";
  if (status === "not_ready") return "dashboard-status dashboard-status--error";
  return "dashboard-status dashboard-status--warning";
}

function actionClass(action: ReadinessAction) {
  if (action.severity === "primary") return "dashboard-button dashboard-button--primary";
  if (action.severity === "warning") return "dashboard-button dashboard-button--secondary";
  return "dashboard-button dashboard-button--ghost";
}

function resolveHref(siteId: string, href?: string) {
  if (!href) return undefined;
  return href.replace(`/sites/${siteId}`, `/sites/${encodeSiteId(siteId)}`);
}

function formatDate(value: string | null) {
  if (!value) return "noch nicht getestet";
  return new Date(value).toLocaleString("de-DE");
}

function CheckRow({
  passed,
  label,
  description,
}: {
  passed: boolean;
  label: string;
  description: string;
}) {
  return (
    <div className="compact-list__row">
      <span>
        <strong>{passed ? "✓" : "!"} {label}</strong>
        <small>{description}</small>
      </span>
      <em>{passed ? "OK" : "prüfen"}</em>
    </div>
  );
}

export function ItSupportReadinessCard({ siteId }: { siteId: string }) {
  const [readiness, setReadiness] = useState<ItSupportReadiness | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/it-support/readiness`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "IT-Support-Agent Status konnte nicht geladen werden.");
        return;
      }
      setReadiness(data as ItSupportReadiness);
    }

    void load();
  }, [siteId]);

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!readiness) {
    return <LoadingState />;
  }

  return (
    <section className="dashboard-card dashboard-card--compact dashboard-stack">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-eyebrow">IT-Support</p>
          <h2 className="dashboard-card-title">IT-Support-Agent Status</h2>
          <p className="dashboard-copy dashboard-copy--muted">{readiness.summary}</p>
        </div>
        <span className={statusClass(readiness.status)}>{readiness.label}</span>
      </div>

      <div className="dashboard-grid dashboard-grid--three dashboard-gap-12">
        <div className="dashboard-card dashboard-card--soft">
          <p className="dashboard-eyebrow">Wissen</p>
          <strong>{readiness.details.activeKnowledgeSourceCount}</strong>
          <p className="dashboard-copy dashboard-copy--muted">aktive Quellen</p>
        </div>
        <div className="dashboard-card dashboard-card--soft">
          <p className="dashboard-eyebrow">Templates</p>
          <strong>
            {readiness.details.importedItKnowledgeTemplateCount}/{readiness.details.availableItKnowledgeTemplateCount}
          </strong>
          <p className="dashboard-copy dashboard-copy--muted">importiert</p>
        </div>
        <div className="dashboard-card dashboard-card--soft">
          <p className="dashboard-eyebrow">Webhook</p>
          <strong>{readiness.details.ticketWebhook.forwardingConfigured ? "aktiv" : "fehlt"}</strong>
          <p className="dashboard-copy dashboard-copy--muted">
            Test: {formatDate(readiness.details.ticketWebhook.lastTestAt)}
          </p>
        </div>
      </div>

      <div className="compact-list">
        {CHECK_LABELS.map((check) => (
          <CheckRow
            key={check.key}
            passed={Boolean(readiness.checks[check.key])}
            label={check.label}
            description={check.description}
          />
        ))}
      </div>

      {readiness.missing.length ? (
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <h3 className="dashboard-card-title dashboard-card-title--sm">Fehlende Punkte</h3>
          {readiness.missing.map((item) => (
            <p key={item} className="dashboard-status dashboard-status--error">{item}</p>
          ))}
        </div>
      ) : null}

      {readiness.warnings.length ? (
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <h3 className="dashboard-card-title dashboard-card-title--sm">Warnungen</h3>
          {readiness.warnings.map((item) => (
            <p key={item} className="dashboard-status dashboard-status--warning">{item}</p>
          ))}
        </div>
      ) : null}

      <div className="dashboard-actions">
        {readiness.actions.map((action) => {
          const href = resolveHref(siteId, action.href);
          if (!href || action.disabled) {
            return (
              <button key={action.key} type="button" className={actionClass(action)} disabled title={action.description}>
                {action.label}
              </button>
            );
          }
          return (
            <Link key={action.key} href={href} className={actionClass(action)} title={action.description}>
              {action.label}
            </Link>
          );
        })}
      </div>

      {readiness.details.ticketWebhook.hasSigningSecret ? (
        <p className="dashboard-copy dashboard-copy--muted">
          Signing Secret vorhanden. Der Wert wird nicht angezeigt.
        </p>
      ) : null}
    </section>
  );
}
