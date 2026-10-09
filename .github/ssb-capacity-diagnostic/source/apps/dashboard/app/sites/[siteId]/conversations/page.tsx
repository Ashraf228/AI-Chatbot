import { ConversationPanel } from "../../../../components/conversations/ConversationPanel";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteConversationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Chats · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <ConversationPanel initialSiteId={siteId} lockedSiteId={siteId} />
      </div>
    </div>
  );
}
