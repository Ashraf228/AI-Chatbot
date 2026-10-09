"use client";

import { useEffect, useMemo, useState } from "react";
import type { BusinessSummary } from "../../lib/business-analytics";
import { encodeSiteId } from "../../lib/site-id";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { getDecisionLabel } from "../../lib/labels";
import { InboxDetailPanel } from "./InboxDetailPanel";
import { InboxFilters } from "./InboxFilters";
import { InboxItemList } from "./InboxItemList";
import { InboxSummaryBar } from "./InboxSummaryBar";
import type { InboxFilter, InboxItem, InboxPriority, InboxSort, InboxItemType } from "./inbox-types";

type LeadRow = {
  id: string;
  siteId: string;
  siteName: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  sessionId?: string;
  status: string;
  createdAt: string;
};

type ConversationRow = {
  id: string;
  site_id: string;
  session_id: string;
  created_at: string;
  last_active_at: string;
  message_count: string;
  last_message?: string | null;
  last_role?: string | null;
  has_lead?: boolean;
  has_handoff?: boolean;
  has_ticket?: boolean;
  decision_type?: string | null;
};

function isToday(value: string) {
  if (!value) {
    return false;
  }

  return new Date(value).toDateString() === new Date().toDateString();
}

function priorityFor(type: InboxItemType, status: string): InboxPriority {
  if (type === "handoff" || type === "ticket" || status === "unanswered") {
    return "high";
  }

  if (type === "lead" || type === "contact_request") {
    return "medium";
  }

  return "low";
}

function normalizeDecision(value: string | null | undefined) {
  return getDecisionLabel(value) || "Chat";
}

function leadToInboxItem(lead: LeadRow): InboxItem {
  const contact = [lead.email, lead.phone].filter(Boolean).join(" · ");
  return {
    id: lead.id,
    type: "lead",
    siteName: lead.siteName || lead.siteId,
    siteId: lead.siteId,
    title: lead.name || "Unbekannter Kontakt",
    subtitle: contact,
    preview: lead.message || "",
    status: lead.status || "new",
    priority: priorityFor("lead", lead.status || "new"),
    createdAt: lead.createdAt,
    lastActivityAt: lead.createdAt,
    href: `/sites/${encodeSiteId(lead.siteId)}/leads`,
    badgeLabel: "Neue Anfrage",
    source: "Widget Chat",
  };
}

function conversationToInboxItem(conversation: ConversationRow): InboxItem {
  const type: InboxItemType = conversation.has_ticket
    ? "ticket"
    : conversation.has_handoff
      ? "handoff"
      : conversation.has_lead
        ? "lead"
        : "conversation";
  const status = conversation.has_ticket
    ? "ticket"
    : conversation.has_handoff
      ? "handoff"
      : conversation.last_role === "user"
        ? "unanswered"
        : conversation.has_lead
          ? "lead"
          : "answered";

  return {
    id: conversation.id,
    type,
    siteName: conversation.site_id,
    siteId: conversation.site_id,
    title: conversation.has_handoff ? "Übergabe nötig" : conversation.has_ticket ? "Ticket erstellt" : "Chat",
    subtitle: `Session ${conversation.session_id?.slice(0, 8) || ""}`,
    preview: conversation.last_message || `${conversation.message_count || 0} Nachrichten`,
    status,
    priority: priorityFor(type, status),
    createdAt: conversation.created_at,
    lastActivityAt: conversation.last_active_at,
    href: `/sites/${encodeSiteId(conversation.site_id)}/conversations`,
    badgeLabel: normalizeDecision(conversation.decision_type),
    source: "Chat",
  };
}

function priorityRank(priority: InboxPriority) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function isHandledStatus(status: string) {
  return ["contacted", "qualified", "closed"].includes(status);
}

export function InboxWorkspace() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [sort, setSort] = useState<InboxSort>("newest");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const [leadsResponse, conversationsResponse, summaryResponse] = await Promise.all([
        fetch("/api/widget/leads", { cache: "no-store" }),
        fetch("/api/conversations", { cache: "no-store" }),
        fetch("/api/dashboard/summary", { cache: "no-store" }),
      ]);

      const [leadsData, conversationsData, summaryData] = await Promise.all([
        leadsResponse.json().catch(() => []),
        conversationsResponse.json().catch(() => []),
        summaryResponse.json().catch(() => null),
      ]);

      const nextItems: InboxItem[] = [];
      if (leadsResponse.ok && Array.isArray(leadsData)) {
        nextItems.push(...(leadsData as LeadRow[]).map(leadToInboxItem));
      }
      if (conversationsResponse.ok && Array.isArray(conversationsData)) {
        nextItems.push(...(conversationsData as ConversationRow[]).map(conversationToInboxItem));
      }
      if (summaryResponse.ok && summaryData) {
        setSummary(summaryData as BusinessSummary);
      }

      if (!leadsResponse.ok && !conversationsResponse.ok) {
        setError("Inbox konnte nicht geladen werden.");
      }

      setItems(nextItems);
      setSelectedItem(nextItems[0] || null);
      setLoading(false);
    }

    load();
  }, []);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (filter === "leads" && item.type !== "lead") return false;
      if (filter === "handoff" && item.type !== "handoff") return false;
      if (filter === "tickets" && item.type !== "ticket") return false;
      if (filter === "unanswered" && item.status !== "unanswered") return false;
      if (filter === "today" && !isToday(item.lastActivityAt || item.createdAt)) return false;
      if (!query) return true;
      return [item.siteName, item.title, item.subtitle, item.preview, item.badgeLabel]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "priority") {
        return priorityRank(a.priority) - priorityRank(b.priority);
      }
      if (sort === "customer") {
        return (a.siteName || a.siteId).localeCompare(b.siteName || b.siteId);
      }
      return new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime();
    });
  }, [filter, items, search, sort]);

  const selectedKey = selectedItem ? `${selectedItem.type}-${selectedItem.id}` : "";
  const newLeads = items.filter((item) => item.type === "lead" && item.status === "new").length;
  const openHandoffs = items.filter((item) => item.type === "handoff").length;
  const unansweredChats = items.filter((item) => item.status === "unanswered").length;
  const openTickets = items.filter((item) => item.type === "ticket").length;
  const handledToday = items.filter((item) => isHandledStatus(item.status) && isToday(item.lastActivityAt)).length;

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="dashboard-stack">
      <InboxSummaryBar
        newLeads={newLeads}
        openHandoffs={openHandoffs}
        unansweredChats={unansweredChats}
        openTickets={openTickets || summary?.openHandoffsOrTickets || 0}
        handledToday={handledToday}
      />
      <InboxFilters
        filter={filter}
        search={search}
        sort={sort}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
        onSortChange={setSort}
      />
      {error ? <ErrorState message={error} /> : null}
      <section className="inbox-workspace-grid">
        <InboxItemList items={visibleItems} selectedId={selectedKey} onSelect={setSelectedItem} />
        <InboxDetailPanel item={selectedItem} />
      </section>
    </div>
  );
}
