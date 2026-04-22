import Link from "next/link";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";

export default async function SiteConversationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return (
    <div>
      <Topbar title={`Conversations · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-card">
          Diese Site nutzt die globale Conversation-Ansicht. Öffne sie mit gesetztem Filter für{" "}
          <strong>{siteId}</strong>.
          <div className="dashboard-mt-14">
            <Link href={`/conversations`} className="dashboard-link-card">
              Zur Conversation-Übersicht
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
