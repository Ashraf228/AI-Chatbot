import Link from "next/link";
import { siteTabs } from "../../lib/dashboard-config";

export function SiteTabs({ siteId }: { siteId: string }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {siteTabs.map((tab) => (
        <Link
          key={tab}
          href={`/sites/${siteId}/${tab}`}
          style={{
            textDecoration: "none",
            color: "#111827",
            padding: "8px 12px",
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          {tab}
        </Link>
      ))}
    </div>
  );
}
