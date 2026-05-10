"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CustomerQuickActions } from "../customer/CustomerQuickActions";
import { CustomerTestChatPanel } from "../customer/CustomerTestChatPanel";
import type { CustomerApiStatus } from "../customer/customer-status";
import { CompactMetricCard } from "../shared/CompactMetricCard";
import { EmptyStateCard } from "../shared/EmptyStateCard";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { encodeSiteId } from "../../lib/site-id";
import type { BusinessActivity, BusinessConversation, BusinessLead, BusinessQuestion, BusinessSummary } from "../../lib/business-analytics";
import { formatNumber, formatPercent } from "../../lib/business-analytics";
import { SetupReadinessChecklist } from "./SetupReadinessChecklist";

type SiteDetails = {
  name: string;
  siteKey: string;
  allowedDomains: string[];
  goLiveAt: string;
};

function formatDate(value: string) {
  if (!value) {
    return "Keine Aktivität";
  }

  return new Date(value).toLocaleString("de-DE");
}

function shortText(value: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  return value.length > 110 ? `${value.slice(0, 110)}...` : value;
}

function latestActivity(data: BusinessSummary | null): BusinessActivity | null {
  if (data?.recentActivity?.[0]) {
    return data.recentActivity[0];
  }

  const conversation = data?.recentConversations?.[0];
  if (conversation) {
    return {
      id: conversation.id,
      label: conversation.lastMessage || "Neues Gespräch",
      status: conversation.hasLead ? "Lead erkannt" : "Chat",
      createdAt: conversation.lastActiveAt,
    };
  }

  const lead = data?.recentLeads?.[0];
  if (lead) {
    return {
      id: lead.id,
      label: lead.name || lead.message || "Neue Anfrage",
      status: lead.status || "Anfrage",
      createdAt: lead.createdAt,
    };
  }

  return null;
}

function QuestionCompactList({
  items,
  emptyLabel,
}: {
  items: BusinessQuestion[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <EmptyStateCard title={emptyLabel} />;
  }

  return (
    <div className="compact-list">
      {items.slice(0, 5).map((item) => (
        <div key={item.question} className="compact-list__row">
          <span>{item.question}</span>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}

function ConversationCompactList({ items }: { items: BusinessConversation[] }) {
  if (items.length === 0) {
    return <EmptyStateCard title="Noch keine Gespräche vorhanden" />;
  }

  return (
    <div className="compact-list">
      {items.slice(0, 4).map((item) => (
        <Link key={item.id} href={`/sites/${encodeSiteId(item.siteId)}/conversations`} className="compact-list__row compact-list__row--link">
          <span>
            <strong>{item.sessionId || "Besucher"}</strong>
            <small>{shortText(item.lastMessage, `${item.messageCount} Nachrichten`)}</small>
          </span>
          <em>{formatDate(item.lastActiveAt)}</em>
        </Link>
      ))}
    </div>
  );
}

function LeadCompactList({ items }: { items: BusinessLead[] }) {
  if (items.length === 0) {
    return <EmptyStateCard title="Noch keine neuen Anfragen vorhanden" />;
  }

  return (
    <div className="compact-list">
      {items.slice(0, 4).map((item) => (
        <Link key={item.id} href={`/sites/${encodeSiteId(item.siteId)}/leads`} className="compact-list__row compact-list__row--link">
          <span>
            <strong>{item.name || "Neue Anfrage"}</strong>
            <small>{shortText(item.message || item.email || item.phone, "Kein Anliegen hinterlegt")}</small>
          </span>
          <em>{item.status || "neu"}</em>
        </Link>
      ))}
    </div>
  );
}

export function CustomerCommandCenter({ siteId }: { siteId: string }) {
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [status, setStatus] = useState<CustomerApiStatus | null>(null);
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [siteResponse, statusResponse, summaryResponse] = await Promise.all([
        fetch(`/api/widget/sites/${encodeURIComponent(siteId)}`, { cache: "no-store" }),
        fetch(`/api/sites/${encodeURIComponent(siteId)}/status`, { cache: "no-store" }),
        fetch(`/api/sites/${encodeURIComponent(siteId)}/analytics/summary`, { cache: "no-store" }),
      ]);

      const [siteData, statusData, summaryData] = await Promise.all([
        siteResponse.json().catch(() => ({})),
        statusResponse.json().catch(() => ({})),
        summaryResponse.json().catch(() => ({})),
      ]);

      if (!siteResponse.ok) {
        setError(siteData?.message || "Kundenübersicht konnte nicht geladen werden.");
        return;
      }

      setSite({
        name: siteData.name || siteId,
        siteKey: siteData.siteKey || "",
        allowedDomains: Array.isArray(siteData.allowedDomains) ? siteData.allowedDomains : [],
        goLiveAt: siteData.goLiveAt || "",
      });

      if (statusResponse.ok && statusData?.status) {
        setStatus(statusData as CustomerApiStatus);
      }

      if (summaryResponse.ok) {
        setSummary(summaryData as BusinessSummary);
      }
    }

    load();
  }, [siteId]);

  const activity = useMemo(() => latestActivity(summary), [summary]);

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!site) {
    return <LoadingState />;
  }

  const isLive = Boolean(site.goLiveAt || status?.lifecycleStatus === "live");
  const widgetReady = Boolean(site.siteKey);
  const knowledgeReady = status?.knowledgeCount ?? summary?.knowledge?.activeReady ?? 0;

  return (
    <div className="customer-command-center">
      <section className="customer-kpi-strip">
        <CompactMetricCard label="Live Status" value={isLive ? "Live" : "Nicht live"} />
        <CompactMetricCard label="Widget Status" value={widgetReady ? "Bereit" : "Fehlt"} />
        <CompactMetricCard label="Chats 7 Tage" value={formatNumber(summary?.conversations7d || 0)} />
        <CompactMetricCard label="Anfragen 7 Tage" value={formatNumber(summary?.leads7d || 0)} />
        <CompactMetricCard label="Conversion" value={formatPercent(summary?.conversionRate || 0)} />
        <CompactMetricCard label="Wissen bereit" value={formatNumber(knowledgeReady)} />
      </section>

      <div className="customer-command-grid">
        <section className="dashboard-stack">
          <SetupReadinessChecklist siteId={siteId} status={status} />

          <section className="dashboard-card dashboard-card--compact dashboard-stack">
            <div className="dashboard-section-heading">
              <div>
                <h2 className="dashboard-card-title">Wissensstatus</h2>
                <p className="dashboard-copy dashboard-copy--muted">Bereite Quellen bestimmen die Antwortqualität.</p>
              </div>
              <Link href={`/sites/${siteSlug}/knowledge`} className="dashboard-button dashboard-button--secondary">
                Wissen öffnen
              </Link>
            </div>
            <div className="dashboard-grid dashboard-grid--three dashboard-gap-12">
              <CompactMetricCard label="bereit" value={formatNumber(summary?.knowledge?.activeReady || knowledgeReady)} />
              <CompactMetricCard label="in Verarbeitung" value={formatNumber(summary?.knowledge?.processing || 0)} />
              <CompactMetricCard label="fehlerhaft" value={formatNumber(summary?.knowledge?.failed || 0)} />
            </div>
          </section>

          <section className="dashboard-card dashboard-card--compact dashboard-stack">
            <h2 className="dashboard-card-title">Empfohlene Schritte</h2>
            {summary?.recommendedActions?.length ? (
              <div className="compact-list">
                {summary.recommendedActions.slice(0, 4).map((item) => (
                  <Link
                    key={`${item.siteId}-${item.label}`}
                    href={item.href.replace(`/sites/${item.siteId}`, `/sites/${encodeSiteId(item.siteId)}`)}
                    className="compact-list__row compact-list__row--link"
                  >
                    <span>{item.label}</span>
                    <strong>{item.priority === "high" ? "hoch" : item.priority === "medium" ? "mittel" : "niedrig"}</strong>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyStateCard title="Aktuell keine dringenden Empfehlungen" />
            )}
          </section>
        </section>

        <section className="dashboard-stack">
          <CustomerQuickActions siteId={siteId} showTestChat={false} />
          <CustomerTestChatPanel siteId={siteId} compact />

          <section className="dashboard-card dashboard-card--compact dashboard-stack">
            <div className="dashboard-section-heading">
              <div>
                <h2 className="dashboard-card-title">Letzte Aktivität</h2>
                <p className="dashboard-copy dashboard-copy--muted">Der letzte relevante Vorgang.</p>
              </div>
              <Link href={`/sites/${siteSlug}/conversations`} className="dashboard-button dashboard-button--secondary">
                Chats öffnen
              </Link>
            </div>
            {activity ? (
              <div className="compact-list">
                <div className="compact-list__row">
                  <span>
                    <strong>{activity.label}</strong>
                    <small>{formatDate(activity.createdAt)}</small>
                  </span>
                  <em>{activity.status}</em>
                </div>
              </div>
            ) : (
              <EmptyStateCard title="Noch keine Aktivität vorhanden" />
            )}
          </section>
        </section>
      </div>

      <section className="dashboard-card dashboard-card--compact dashboard-stack">
        <div className="dashboard-section-heading">
          <div>
            <h2 className="dashboard-card-title">Business Performance</h2>
            <p className="dashboard-copy dashboard-copy--muted">Kompakte Betriebszahlen ohne technische Details.</p>
          </div>
          <Link href={`/sites/${siteSlug}/analytics`} className="dashboard-button dashboard-button--secondary">
            Auswertung öffnen
          </Link>
        </div>
        <div className="dashboard-grid dashboard-grid--metrics-3 dashboard-gap-12">
          <CompactMetricCard label="Chats heute" value={formatNumber(summary?.conversationsToday || 0)} />
          <CompactMetricCard label="Chats 7 Tage" value={formatNumber(summary?.conversations7d || 0)} />
          <CompactMetricCard label="Anfragen 7 Tage" value={formatNumber(summary?.leads7d || 0)} />
          <CompactMetricCard label="Conversion" value={formatPercent(summary?.conversionRate || 0)} />
          <CompactMetricCard label="Knowledge-Hit-Rate" value={formatPercent(summary?.knowledgeHitRate || 0)} />
          <CompactMetricCard label="Offene Handoffs/Tickets" value={formatNumber(summary?.openHandoffsOrTickets || 0)} />
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--two dashboard-gap-12">
        <section className="dashboard-card dashboard-card--compact dashboard-stack">
          <h2 className="dashboard-card-title">Häufige Fragen</h2>
          <QuestionCompactList items={summary?.topQuestions || []} emptyLabel="Noch keine häufigen Fragen vorhanden" />
        </section>
        <section className="dashboard-card dashboard-card--compact dashboard-stack">
          <h2 className="dashboard-card-title">Offene Fragen</h2>
          <QuestionCompactList items={summary?.unansweredQuestions || []} emptyLabel="Keine offenen Fragen erkannt" />
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two dashboard-gap-12">
        <section className="dashboard-card dashboard-card--compact dashboard-stack">
          <div className="dashboard-section-heading">
            <h2 className="dashboard-card-title">Letzte Gespräche</h2>
            <Link href={`/sites/${siteSlug}/conversations`} className="dashboard-link-card">
              alle öffnen
            </Link>
          </div>
          <ConversationCompactList items={summary?.recentConversations || []} />
        </section>
        <section className="dashboard-card dashboard-card--compact dashboard-stack">
          <div className="dashboard-section-heading">
            <h2 className="dashboard-card-title">Letzte Anfragen</h2>
            <Link href={`/sites/${siteSlug}/leads`} className="dashboard-link-card">
              alle öffnen
            </Link>
          </div>
          <LeadCompactList items={summary?.recentLeads || []} />
        </section>
      </div>
    </div>
  );
}
