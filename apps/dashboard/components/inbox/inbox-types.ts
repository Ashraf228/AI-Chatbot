export type InboxItemType = "lead" | "conversation" | "handoff" | "ticket" | "contact_request";
export type InboxPriority = "high" | "medium" | "low";

export type InboxItem = {
  id: string;
  type: InboxItemType;
  siteName: string;
  siteId: string;
  title: string;
  subtitle: string;
  preview: string;
  status: string;
  priority: InboxPriority;
  createdAt: string;
  lastActivityAt: string;
  href: string;
  badgeLabel: string;
  source: string;
};

export type InboxFilter = "all" | "leads" | "handoff" | "tickets" | "unanswered" | "today";
export type InboxSort = "newest" | "priority" | "customer";
