import { Select } from "../shared/Select";

type LeadFiltersProps = {
  status: string;
  onStatusChange: (value: string) => void;
};

export function LeadFilters({ status, onStatusChange }: LeadFiltersProps) {
  return (
    <div className="dashboard-inline dashboard-gap-12 dashboard-mb-16">
      <Select value={status} onChange={(e) => onStatusChange(e.target.value)}>
        <option value="">Alle Status</option>
        <option value="new">new</option>
        <option value="contacted">contacted</option>
        <option value="qualified">qualified</option>
        <option value="lost">lost</option>
      </Select>
    </div>
  );
}
