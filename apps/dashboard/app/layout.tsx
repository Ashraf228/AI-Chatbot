import type { ReactNode } from "react";
import { Sidebar } from "../components/layout/Sidebar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          fontFamily: '"Avenir Next", "Segoe UI", system-ui, sans-serif',
          background:
            "radial-gradient(circle at top left, rgba(28,25,23,0.14), transparent 28%), linear-gradient(180deg, #f7f5f2 0%, #efebe6 100%)",
          color: "#111827",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            minHeight: "100vh",
          }}
        >
          <Sidebar />
          <main
            style={{
              padding: 18,
            }}
          >
            <div
              style={{
                minHeight: "calc(100vh - 36px)",
                borderRadius: 28,
                overflow: "hidden",
                background: "rgba(255,255,255,0.72)",
                boxShadow: "0 24px 80px rgba(28,25,23,0.10)",
                backdropFilter: "blur(12px)",
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
