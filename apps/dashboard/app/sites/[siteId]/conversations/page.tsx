import Link from "next/link";
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
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-card">
          Dieser Kunde nutzt die globale Chat-Ansicht. Öffne sie mit gesetztem Filter für{" "}
          <strong>{siteId}</strong>.
          <div className="dashboard-mt-14">
            <Link href={`/conversations`} className="dashboard-link-card">
              Zur Chat-Übersicht
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
