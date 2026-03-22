import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ maxWidth: 900, margin: "40px auto" }}>
      <h1>Willkommen im Admin Panel</h1>
      <p>Verwalte hier deine Sites, FAQ-Inhalte und PDF-Dokumente.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <Link
          href="/sites"
          style={{
            textDecoration: "none",
            color: "#111",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2>Sites</h2>
          <p>Sites anlegen, Public Keys sehen und Embed Code kopieren.</p>
        </Link>

        <Link
          href="/ingest"
          style={{
            textDecoration: "none",
            color: "#111",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2>FAQ Ingest</h2>
          <p>Fragen und Antworten direkt in die Knowledge Base schreiben.</p>
        </Link>

        <Link
          href="/pdf"
          style={{
            textDecoration: "none",
            color: "#111",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2>PDF Upload</h2>
          <p>PDF-Dateien hochladen und automatisch indexieren.</p>
        </Link>
      </div>
    </div>
  );
}