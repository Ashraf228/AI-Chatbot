import type { ReactNode } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="dashboard-root">
          <Sidebar />
          <main className="dashboard-main">
            <div className="dashboard-surface">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
