"use client";

import { Input } from "../shared/Input";
import { Select } from "../shared/Select";
import type { InboxFilter, InboxSort } from "./inbox-types";

const FILTERS: Array<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "leads", label: "Neue Anfragen" },
  { value: "handoff", label: "Handoff" },
  { value: "tickets", label: "Tickets" },
  { value: "unanswered", label: "Unbeantwortet" },
  { value: "today", label: "Heute" },
];

export function InboxFilters({
  filter,
  search,
  sort,
  onFilterChange,
  onSearchChange,
  onSortChange,
}: {
  filter: InboxFilter;
  search: string;
  sort: InboxSort;
  onFilterChange: (value: InboxFilter) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: InboxSort) => void;
}) {
  return (
    <section className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
      <div className="inbox-filter-tabs">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? "is-active" : ""}
            onClick={() => onFilterChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="dashboard-grid dashboard-grid--two dashboard-gap-12">
        <label className="dashboard-field">
          <span className="dashboard-field-label">Suche</span>
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Kunde, Kontakt, Nachricht"
          />
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Sortierung</span>
          <Select value={sort} onChange={(event) => onSortChange(event.target.value as InboxSort)}>
            <option value="newest">Neueste zuerst</option>
            <option value="priority">Priorität</option>
            <option value="customer">Kunde</option>
          </Select>
        </label>
      </div>
    </section>
  );
}
