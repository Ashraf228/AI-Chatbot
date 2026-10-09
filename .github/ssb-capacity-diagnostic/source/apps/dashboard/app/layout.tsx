import type { ReactNode } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import "./globals.css";

export const metadata = {
  title: "Soulé Dashboard",
  description: "Dashboard fuer Chatbot-Konfiguration, Evaluation und Betrieb.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="dashboard-root">
          <a className="dashboard-skip-link" href="#dashboard-main">
            Zum Hauptinhalt springen
          </a>
          <Sidebar />
          <main id="dashboard-main" className="dashboard-main" tabIndex={-1}>
            <div className="dashboard-surface">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
