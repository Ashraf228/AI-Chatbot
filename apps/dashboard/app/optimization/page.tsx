import { OptimizationOverview } from "../../components/analytics/OptimizationOverview";
import { Topbar } from "../../components/layout/Topbar";

export default function OptimizationPage() {
  return (
    <div>
      <Topbar title="Optimization" />
      <div style={{ padding: 24 }}>
        <OptimizationOverview />
      </div>
    </div>
  );
}
