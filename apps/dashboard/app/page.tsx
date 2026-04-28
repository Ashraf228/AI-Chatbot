import Link from "next/link";
import { Topbar } from "../components/layout/Topbar";

const cards = [
  {
    href: "/sites",
    title: "Kunden",
    description: "Kunden anlegen, Domains pflegen und Einbindungen vorbereiten.",
  },
  {
    href: "/ingest",
    title: "Wissen",
    description: "Fragen, Antworten und Website-Wissen für Kunden pflegen.",
  },
  {
    href: "/pdf",
    title: "PDFs",
    description: "Dokumente hochladen und für den Chatbot nutzbar machen.",
  },
  {
    href: "/leads",
    title: "Anfragen",
    description: "Neue Kontakte prüfen, sortieren und weiterbearbeiten.",
  },
  {
    href: "/usage",
    title: "Kosten",
    description: "Nutzung, Tokens, Latenzen und Kosten im Blick behalten.",
  },
  {
    href: "/conversations",
    title: "Chats",
    description: "Verläufe prüfen, Nachrichten lesen und Auffälligkeiten erkennen.",
  },
];

export default function DashboardHomePage() {
  return (
    <div>
      <Topbar title="Heute" />
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
