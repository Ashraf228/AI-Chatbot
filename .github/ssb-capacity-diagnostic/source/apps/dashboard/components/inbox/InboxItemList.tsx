"use client";

import { EmptyStateCard } from "../shared/EmptyStateCard";
import { InboxItemCard } from "./InboxItemCard";
import type { InboxItem } from "./inbox-types";

export function InboxItemList({
  items,
  selectedId,
  onSelect,
}: {
  items: InboxItem[];
  selectedId: string;
  onSelect: (item: InboxItem) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyStateCard
        title="Keine offenen Vorgänge"
        description="Neue Anfragen und Chats erscheinen hier."
        href="/sites"
        actionLabel="Kunden öffnen"
      />
    );
  }

  return (
    <div className="inbox-item-list">
      {items.map((item) => (
        <InboxItemCard
          key={`${item.type}-${item.id}`}
          item={item}
          selected={selectedId === `${item.type}-${item.id}`}
          onSelect={() => onSelect(item)}
        />
      ))}
    </div>
  );
}
