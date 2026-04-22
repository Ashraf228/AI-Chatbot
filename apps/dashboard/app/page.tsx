import Link from "next/link";
import { Topbar } from "../components/layout/Topbar";

const cards = [
  {
    href: "/sites",
    title: "Sites verwalten",
    description: "Neue Kunden-Sites anlegen, Domains pflegen und Embed-Snippets kopieren.",
  },
  {
    href: "/ingest",
    title: "FAQ Ingest",
    description: "Fragen und Antworten schnell in die Wissensbasis laden.",
  },
  {
    href: "/pdf",
    title: "PDF Upload",
    description: "Kundendokumente hochladen und für Retrieval aufbereiten.",
  },
  {
    href: "/usage",
    title: "Usage & Kosten",
    description: "Requests, Tokens, Kosten und Latenzen im Blick behalten.",
  },
  {
    href: "/conversations",
    title: "Conversations",
    description: "Chats prüfen, Nachrichten lesen und problematische Verläufe bereinigen.",
  },
];

export default function DashboardHomePage() {
  return (
    <div>
      <Topbar title="Overview" />
      <div className="dashboard-page">
        <div
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{
                textDecoration: "none",
                color: "inherit",
              }}
              className="dashboard-card"
            >
              <h2 className="dashboard-card-title">{card.title}</h2>
              <p className="dashboard-copy" style={{ marginBottom: 0 }}>
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
