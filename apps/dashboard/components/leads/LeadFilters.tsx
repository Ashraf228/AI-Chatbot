type LeadFiltersProps = {
  status: string;
  onStatusChange: (value: string) => void;
};

export function LeadFilters({ status, onStatusChange }: LeadFiltersProps) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
      >
        <option value="">Alle Status</option>
        <option value="new">new</option>
        <option value="contacted">contacted</option>
        <option value="qualified">qualified</option>
        <option value="lost">lost</option>
      </select>
    </div>
  );
}
