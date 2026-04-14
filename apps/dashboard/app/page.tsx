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
      <div style={{ padding: 24 }}>
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
                color: "#111827",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <h2 style={{ marginTop: 0, fontSize: 18 }}>{card.title}</h2>
              <p style={{ marginBottom: 0, lineHeight: 1.5, color: "#4b5563" }}>
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
