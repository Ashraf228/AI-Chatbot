import Link from "next/link";
import type { CSSProperties } from "react";
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
      <div style={{ padding: 24 }}>
        <SiteTabs siteId={siteId} />
        <div style={cardStyle}>
          Diese Site nutzt die globale Conversation-Ansicht. Öffne sie mit gesetztem Filter für{" "}
          <strong>{siteId}</strong>.
          <div style={{ marginTop: 14 }}>
            <Link href={`/conversations`} style={linkStyle}>
              Zur Conversation-Übersicht
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};

const linkStyle: CSSProperties = {
  color: "#111827",
};
