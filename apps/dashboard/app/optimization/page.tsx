import { OptimizationOverview } from "../../components/analytics/OptimizationOverview";
import { Topbar } from "../../components/layout/Topbar";

export default function OptimizationPage() {
  return (
    <div>
      <Topbar title="Verbesserung" />
      <div className="dashboard-page">
        <OptimizationOverview />
      </div>
    </div>
  );
}
