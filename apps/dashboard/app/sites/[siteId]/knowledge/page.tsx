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
      <Topbar title={`Wissen · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-card dashboard-stack" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="dashboard-card-title">Wissen für diesen Kunden</h2>
            <p className="dashboard-copy">
              Pflege hier alle Inhalte, aus denen der Bot später antworten soll. Die Eingabe bleibt
              kundenbezogen, auch wenn einzelne Formulare technisch auf bestehende Importseiten führen.
            </p>
          </div>
        </div>
        <div className="dashboard-grid dashboard-grid--two dashboard-gap-16">
          <Link href={`/ingest?siteId=${siteSlug}`} className="dashboard-card dashboard-link-card">
            Website, FAQs und Antworten pflegen
          </Link>
          <Link href={`/pdf?siteId=${siteSlug}`} className="dashboard-card dashboard-link-card">
            PDFs und Dateien für diesen Kunden hochladen
          </Link>
        </div>
        <KnowledgeManager siteId={siteId} />
      </div>
    </div>
  );
}
