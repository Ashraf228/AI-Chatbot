import Link from "next/link";
import { EmptyStateCard } from "../shared/EmptyStateCard";
import type { InboxItem } from "./inbox-types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("de-DE");
}

export function InboxDetailPanel({ item }: { item: InboxItem | null }) {
  if (!item) {
    return (
      <section className="dashboard-card dashboard-card--compact">
        <EmptyStateCard title="Vorgang auswählen" description="Wähle links eine Anfrage oder einen Chat aus." />
      </section>
    );
  }

  return (
    <section className="dashboard-card dashboard-card--compact dashboard-stack">
      <div className="dashboard-section-heading">
        <div>
          <h2 className="dashboard-card-title">{item.title}</h2>
          <p className="dashboard-copy dashboard-copy--muted">{item.siteName || item.siteId}</p>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>

      <div className="dashboard-inline dashboard-wrap">
        <StatusBadge status={item.status} />
        <span className="dashboard-badge">{item.badgeLabel}</span>
        <span className="dashboard-badge">{item.source}</span>
      </div>

      {item.subtitle ? (
        <div className="dashboard-card dashboard-card--soft">
          <strong>Kontakt / Kontext</strong>
          <p className="dashboard-copy dashboard-copy--muted">{item.subtitle}</p>
        </div>
      ) : null}

      {item.preview ? (
        <div className="dashboard-card dashboard-card--soft">
          <strong>Vorschau</strong>
          <p className="dashboard-copy">{item.preview}</p>
        </div>
      ) : null}

      <div className="dashboard-grid dashboard-grid--two dashboard-gap-12">
        <div className="dashboard-card dashboard-card--soft">
          <strong>Erstellt</strong>
          <p className="dashboard-copy dashboard-copy--muted">{formatDate(item.createdAt)}</p>
        </div>
        <div className="dashboard-card dashboard-card--soft">
          <strong>Letzte Aktivität</strong>
          <p className="dashboard-copy dashboard-copy--muted">{formatDate(item.lastActivityAt)}</p>
        </div>
      </div>

      <Link href={item.href} className="dashboard-button dashboard-button--primary">
        Vorgang öffnen
      </Link>
    </section>
  );
}
