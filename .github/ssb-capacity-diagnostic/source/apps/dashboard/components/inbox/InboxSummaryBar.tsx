import { CompactMetricCard } from "../shared/CompactMetricCard";

type InboxSummaryBarProps = {
  newLeads: number;
  openHandoffs: number;
  unansweredChats: number;
  openTickets: number;
  handledToday: number;
};

export function InboxSummaryBar({
  newLeads,
  openHandoffs,
  unansweredChats,
  openTickets,
  handledToday,
}: InboxSummaryBarProps) {
  return (
    <section className="inbox-summary-bar">
      <CompactMetricCard label="Neue Anfragen" value={newLeads} />
      <CompactMetricCard label="Offene Handoffs" value={openHandoffs} />
      <CompactMetricCard label="Unbeantwortete Chats" value={unansweredChats} />
      <CompactMetricCard label="Tickets offen" value={openTickets} />
      <CompactMetricCard label="Heute bearbeitet" value={handledToday} />
    </section>
  );
}
