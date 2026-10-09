import Link from "next/link";
import { InboxWorkspace } from "../../components/inbox/InboxWorkspace";
import { Topbar } from "../../components/layout/Topbar";
import { CompactPageHeader } from "../../components/shared/CompactPageHeader";

export default function InboxPage() {
  return (
    <div>
      <Topbar title="Inbox" />
      <div className="dashboard-page dashboard-page--lg">
        <CompactPageHeader
          eyebrow="Betrieb"
          title="Anfragen und Chats an einem Ort"
          description="Prüfe neue Kontakte, offene Gespräche und Auffälligkeiten, ohne zwischen technischen Bereichen zu suchen."
          actions={
            <Link href="/sites" className="dashboard-button dashboard-button--secondary">
              Kunden öffnen
            </Link>
          }
        />

        <InboxWorkspace />
      </div>
    </div>
  );
}
