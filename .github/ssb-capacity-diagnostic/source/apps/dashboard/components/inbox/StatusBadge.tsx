import type { InboxPriority } from "./inbox-types";
import { getStatusLabel, getStatusTone } from "../../lib/labels";

export function StatusBadge({ status }: { status: string }) {
  const label = getStatusLabel(status);
  const tone = getStatusTone(status);
  const classTone = tone === "success" ? "done" : tone === "warning" ? "warning" : tone;

  return <span className={`inbox-badge inbox-badge--${classTone}`}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority: InboxPriority }) {
  const label = priority === "high" ? "Hoch" : priority === "medium" ? "Mittel" : "Niedrig";
  return <span className={`inbox-badge inbox-badge--priority-${priority}`}>{label}</span>;
}
