import Link from "next/link";
import type { CSSProperties } from "react";
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
      <div style={{ padding: 24 }}>
        <SiteTabs siteId={siteId} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <Link href={`/ingest?siteId=${siteId}`} style={cardStyle}>
            FAQ-Inhalte bearbeiten
          </Link>
          <Link href={`/pdf?siteId=${siteId}`} style={cardStyle}>
            PDFs für diese Site hochladen
          </Link>
        </div>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  textDecoration: "none",
  color: "#111827",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};
