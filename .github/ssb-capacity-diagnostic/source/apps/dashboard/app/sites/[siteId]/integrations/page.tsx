import { SiteIntegrationsForm } from "../../../../components/integrations/SiteIntegrationsForm";
import { TicketWebhookSettingsCard } from "../../../../components/integrations/TicketWebhookSettingsCard";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteIntegrationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Verbindungen · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <TicketWebhookSettingsCard siteId={siteId} />
        <SiteIntegrationsForm siteId={siteId} hiddenProviderKeys={["ticket-webhook"]} />
      </div>
    </div>
  );
}
