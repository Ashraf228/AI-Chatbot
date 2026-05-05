import { KnowledgeWorkspace } from "../../../../components/knowledge/KnowledgeWorkspace";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteKnowledgePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

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
        <KnowledgeWorkspace siteId={siteId} />
      </div>
    </div>
  );
}
