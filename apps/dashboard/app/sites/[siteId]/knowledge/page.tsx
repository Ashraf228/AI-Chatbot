import Link from "next/link";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { KnowledgeManager } from "../../../../components/knowledge/KnowledgeManager";
import { decodeSiteId, encodeSiteId } from "../../../../lib/site-id";

export default async function SiteKnowledgePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);
  const siteSlug = encodeSiteId(siteId);

  return (
    <div>
      <Topbar title={`Knowledge · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-grid dashboard-grid--two dashboard-gap-16">
          <Link href={`/ingest?siteId=${siteSlug}`} className="dashboard-card dashboard-link-card">
            FAQ-Inhalte bearbeiten
          </Link>
          <Link href={`/pdf?siteId=${siteSlug}`} className="dashboard-card dashboard-link-card">
            PDFs für diese Site hochladen
          </Link>
        </div>
        <KnowledgeManager siteId={siteId} />
      </div>
    </div>
  );
}
