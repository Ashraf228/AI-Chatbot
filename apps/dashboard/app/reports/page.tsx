import { ReportHistoryTable } from "../../components/reports/ReportHistoryTable";
import { Topbar } from "../../components/layout/Topbar";

export default function ReportsPage() {
  return (
    <div>
      <Topbar title="Reports" />
      <div style={{ padding: 24 }}>
        <ReportHistoryTable />
      </div>
    </div>
  );
}
