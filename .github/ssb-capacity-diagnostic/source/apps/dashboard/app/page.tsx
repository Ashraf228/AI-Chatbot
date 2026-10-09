"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BusinessMetricCard } from "../components/dashboard/BusinessMetricCard";
import { QuestionList, RecentConversations, RecentLeads, RecommendedActions } from "../components/dashboard/BusinessLists";
import { Topbar } from "../components/layout/Topbar";
import { ErrorState } from "../components/shared/ErrorState";
import { LoadingState } from "../components/shared/LoadingState";
import type { BusinessSummary } from "../lib/business-analytics";
import { formatMinutes, formatNumber, formatPercent } from "../lib/business-analytics";

const quickLinks = [
  { href: "/sites", title: "Kunden", description: "Kunden anlegen, Setup fortsetzen und Widget einbinden." },
  { href: "/leads", title: "Anfragen", description: "Neue Kontakte prüfen und den Status pflegen." },
  { href: "/conversations", title: "Chats", description: "Gespräche prüfen und Wissenslücken erkennen." },
  { href: "/reports", title: "Berichte", description: "Zusammenfassungen und Report-Historie ansehen." },
];

export default function DashboardHomePage() {
  const [data, setData] = useState<BusinessSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.message || "Dashboard konnte nicht geladen werden.");
        return;
      }
      setData(json as BusinessSummary);
    }
    load();
  }, []);

  if (error) {
    return (
      <div>
        <Topbar title="Heute" />
        <div className="dashboard-page">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Topbar title="Heute" />
        <div className="dashboard-page">
          <LoadingState />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Heute" />
      <div className="dashboard-page dashboard-page--wide dashboard-stack">
        <section className="dashboard-card dashboard-stack">
          <div>
            <h2 className="dashboard-card-title">Business Überblick</h2>
            <p className="dashboard-copy">
              Zeigt, wie aktiv die KI-Systeme sind, wie viele Anfragen entstehen und wo als Nächstes optimiert werden sollte.
            </p>
          </div>
          <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
            <BusinessMetricCard label="Gespräche heute" value={formatNumber(data.conversationsToday)} />
            <BusinessMetricCard label="Neue Anfragen" value={formatNumber(data.leadsToday)} />
            <BusinessMetricCard label="Conversion Rate 7 Tage" value={formatPercent(data.conversionRate)} />
            <BusinessMetricCard label="Aktive Kunden" value={formatNumber(data.activeSites || 0)} />
          </div>
          <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
            <BusinessMetricCard
              label="Grobe Supportzeit gespart"
              value={formatMinutes(data.estimatedSupportTimeSavedMinutes)}
              hint={`${data.supportTimeAssumptionMinutes} Min. Annahme pro Gespräch`}
            />
            <BusinessMetricCard label="Offene Handoffs/Tickets" value={formatNumber(data.openHandoffsOrTickets)} />
            <BusinessMetricCard label="Knowledge-Hit-Rate" value={formatPercent(data.knowledgeHitRate)} />
            <BusinessMetricCard label="Tool-Aktionen 7 Tage" value={formatNumber(data.toolExecutionCount)} />
          </div>
        </section>

        <div className="dashboard-grid dashboard-grid--split" style={{ gap: 18 }}>
          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Nächste empfohlene Aktionen</h2>
              <p className="dashboard-copy">Konkrete Schritte, die Setup, Live-Schaltung oder Qualität verbessern.</p>
            </div>
            <RecommendedActions items={data.recommendedActions || []} />
          </section>

          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Schnellstart</h2>
              <p className="dashboard-copy">Die wichtigsten Arbeitsbereiche für den Betrieb.</p>
            </div>
            <div className="dashboard-hub-grid">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="dashboard-hub-link">
                  <strong>{link.title}</strong>
                  <span>{link.description}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="dashboard-grid dashboard-grid--two" style={{ gap: 18 }}>
          <section className="dashboard-card dashboard-stack">
            <h2 className="dashboard-card-title">Letzte Gespräche</h2>
            <RecentConversations items={data.recentConversations || []} />
          </section>
          <section className="dashboard-card dashboard-stack">
            <h2 className="dashboard-card-title">Letzte Anfragen</h2>
            <RecentLeads items={data.recentLeads || []} />
          </section>
        </div>

        <div className="dashboard-grid dashboard-grid--two" style={{ gap: 18 }}>
          <section className="dashboard-card dashboard-stack">
            <h2 className="dashboard-card-title">Häufige Fragen</h2>
            <QuestionList items={data.topQuestions || []} emptyLabel="Noch keine häufigen Fragen vorhanden." />
          </section>
          <section className="dashboard-card dashboard-stack">
            <h2 className="dashboard-card-title">Offene Fragen</h2>
            <QuestionList items={data.unansweredQuestions || []} emptyLabel="Keine offenen Fragen erkannt." />
          </section>
        </div>
      </div>
    </div>
  );
}
