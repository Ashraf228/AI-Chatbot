import Link from "next/link";
import { encodeSiteId } from "../../lib/site-id";
import { getStatusLabel } from "../../lib/labels";
import type { BusinessConversation, BusinessLead, BusinessQuestion, RecommendedAction } from "../../lib/business-analytics";
import { EmptyStateCard } from "../shared/EmptyStateCard";

export function RecommendedActions({ items }: { items: RecommendedAction[] }) {
  if (items.length === 0) {
    return <EmptyStateCard title="Keine dringenden Empfehlungen" description="Wenn Handlungsbedarf entsteht, erscheint er hier." />;
  }

  return (
    <div className="dashboard-stack dashboard-stack--sm">
      {items.map((item) => (
        <Link
          key={`${item.siteId}-${item.label}`}
          href={item.href.replace(`/sites/${item.siteId}`, `/sites/${encodeSiteId(item.siteId)}`)}
          className="dashboard-link-card"
        >
          <strong>{item.label}</strong>
          <span>{item.siteName}</span>
        </Link>
      ))}
    </div>
  );
}

export function RecentConversations({ items }: { items: BusinessConversation[] }) {
  if (items.length === 0) {
    return <EmptyStateCard title="Noch keine Gespräche vorhanden" description="Neue Gespräche erscheinen nach den ersten Widget-Chats." />;
  }

  return (
    <div className="dashboard-stack dashboard-stack--sm">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/sites/${encodeSiteId(item.siteId)}/conversations`}
          className="dashboard-card dashboard-card--soft"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <div className="dashboard-info-row">
            <strong>{item.siteName || item.siteId}</strong>
            <span>{new Date(item.lastActiveAt).toLocaleString("de-DE")}</span>
          </div>
          <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
            {item.lastMessage || `${item.messageCount} Nachrichten`}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function RecentLeads({ items }: { items: BusinessLead[] }) {
  if (items.length === 0) {
    return <EmptyStateCard title="Noch keine Anfragen vorhanden" description="Neue Kontakte aus dem Widget erscheinen hier." />;
  }

  return (
    <div className="dashboard-stack dashboard-stack--sm">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/sites/${encodeSiteId(item.siteId)}/leads`}
          className="dashboard-card dashboard-card--soft"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <div className="dashboard-info-row">
            <strong>{item.name || "Neue Anfrage"}</strong>
            <span>{getStatusLabel(item.status)}</span>
          </div>
          <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
            {item.siteName} · {item.message || item.email || item.phone}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function QuestionList({ items, emptyLabel }: { items: BusinessQuestion[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <EmptyStateCard title={emptyLabel.replace(/\.$/, "")} />;
  }

  return (
    <div className="dashboard-stack dashboard-stack--sm">
      {items.map((item) => (
        <div key={item.question} className="dashboard-info-row">
          <span className="dashboard-breakword">{item.question}</span>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}
