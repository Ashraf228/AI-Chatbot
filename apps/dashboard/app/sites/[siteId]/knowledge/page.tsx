import Link from "next/link";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";

export default async function SiteKnowledgePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return (
    <div>
      <Topbar title={`Knowledge · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-grid dashboard-grid--two dashboard-gap-16">
          <Link href={`/ingest?siteId=${siteId}`} className="dashboard-card dashboard-link-card">
            FAQ-Inhalte bearbeiten
          </Link>
          <Link href={`/pdf?siteId=${siteId}`} className="dashboard-card dashboard-link-card">
            PDFs für diese Site hochladen
          </Link>
        </div>
      </div>
    </div>
  );
}
