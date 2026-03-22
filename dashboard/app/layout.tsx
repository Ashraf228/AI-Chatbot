import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f5f7fb",
          color: "#111",
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #ddd",
            background: "#fff",
            padding: "14px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>SSB Admin Panel</div>

          <nav style={{ display: "flex", gap: 16 }}>
            <Link href="/sites" style={{ textDecoration: "none", color: "#111" }}>
              Sites
            </Link>
            <Link href="/ingest" style={{ textDecoration: "none", color: "#111" }}>
              FAQ
            </Link>
            <Link href="/pdf" style={{ textDecoration: "none", color: "#111" }}>
              PDF
            </Link>
            <Link href="/conversations" style={{ textDecoration: "none", color: "#111" }}>
  Conversations
</Link>
          </nav>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              style={{
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: 8,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </form>
        </header>

        <main style={{ padding: "24px" }}>{children}</main>
      </body>
    </html>
  );
}