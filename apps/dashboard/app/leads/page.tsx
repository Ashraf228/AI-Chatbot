import { LeadTable } from "../../components/leads/LeadTable";
import { Topbar } from "../../components/layout/Topbar";

export default function LeadsPage() {
  return (
    <div>
      <Topbar title="Leads" />
      <div style={{ padding: 24 }}>
        <LeadTable />
      </div>
    </div>
  );
}
