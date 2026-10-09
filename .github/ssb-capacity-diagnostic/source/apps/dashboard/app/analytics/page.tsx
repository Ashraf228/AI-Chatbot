import Link from "next/link";
import { Topbar } from "../../components/layout/Topbar";
import { CompactPageHeader } from "../../components/shared/CompactPageHeader";
import { EmptyStateCard } from "../../components/shared/EmptyStateCard";

export default function AnalyticsPage() {
  return (
    <div>
      <Topbar title="Auswertung" />
      <div className="dashboard-page dashboard-page--lg">
        <CompactPageHeader
          eyebrow="Auswertung"
          title="Berichte, Nutzung und Optimierung"
          description="Die wichtigsten Auswertungen bleiben erreichbar, sind aber nicht mehr als einzelne Hauptmenüpunkte verteilt."
          actions={
            <Link href="/sites" className="dashboard-button dashboard-button--secondary">
              Kundenauswertung öffnen
            </Link>
          }
        />

        <div className="dashboard-grid dashboard-grid--three">
          <EmptyStateCard
            title="Berichte"
            description="Report-Historie und regelmäßige Auswertungen."
            href="/reports"
            actionLabel="Berichte öffnen"
          />
          <EmptyStateCard
            title="Nutzung"
            description="Technische Nutzung und Verbrauch prüfen."
            href="/usage"
            actionLabel="Nutzung öffnen"
          />
          <EmptyStateCard
            title="Kunden-Analytics"
            description="Öffne einen Kunden und prüfe dort Chats, Leads und Conversion."
            href="/sites"
            actionLabel="Kunden öffnen"
          />
        </div>
      </div>
    </div>
  );
}
