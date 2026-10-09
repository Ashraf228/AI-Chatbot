import { ReportHistoryTable } from "../../components/reports/ReportHistoryTable";
import { Topbar } from "../../components/layout/Topbar";

export default function ReportsPage() {
  return (
    <div>
      <Topbar title="Berichte" />
      <div className="dashboard-page">
        <ReportHistoryTable />
      </div>
    </div>
  );
}
