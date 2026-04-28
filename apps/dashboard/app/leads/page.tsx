import { LeadTable } from "../../components/leads/LeadTable";
import { Topbar } from "../../components/layout/Topbar";

export default function LeadsPage() {
  return (
    <div>
      <Topbar title="Anfragen" />
      <div className="dashboard-page">
        <LeadTable />
      </div>
    </div>
  );
}
