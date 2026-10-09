import { BillingOverview } from "../../components/billing/BillingOverview";
import { Topbar } from "../../components/layout/Topbar";
import { getDashboardSession } from "../../lib/auth";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const session = await getDashboardSession();
  if (session?.role === "customer") {
    redirect("/sites");
  }

  return (
    <div>
      <Topbar title="Plan & Nutzung" />
      <div className="dashboard-page dashboard-page--lg">
        <BillingOverview />
      </div>
    </div>
  );
}
