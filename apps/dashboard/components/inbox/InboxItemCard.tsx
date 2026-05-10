"use client";

import type { InboxItem } from "./inbox-types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("de-DE");
}

export function InboxItemCard({
  item,
  selected,
  onSelect,
}: {
  item: InboxItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`inbox-item-card${selected ? " inbox-item-card--selected" : ""}`}
      onClick={onSelect}
    >
      <div className="inbox-item-card__head">
        <div>
          <strong>{item.title}</strong>
          <span>{item.siteName || item.siteId}</span>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>
      <p>{item.preview || item.subtitle}</p>
      <div className="inbox-item-card__meta">
        <StatusBadge status={item.status} />
        <span>{item.badgeLabel}</span>
        <time>{formatDate(item.lastActivityAt || item.createdAt)}</time>
      </div>
    </button>
  );
}
