import { BrandLogo } from "./BrandLogo";
import Link from "next/link";
import { dashboardNav } from "../../lib/dashboard-config";

export function Sidebar() {
  return (
    <aside
      style={{
        width: 240,
        padding: 24,
        background: "linear-gradient(180deg, #111111 0%, #1f1a17 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      <BrandLogo size={56} />

      <nav style={{ display: "grid", gap: 10 }}>
        {dashboardNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              color: "#f5f5f4",
              textDecoration: "none",
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontWeight: 500,
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <form action="/api/auth/logout" method="POST" style={{ marginTop: "auto" }}>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            color: "#f5f5f4",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </form>
    </aside>
  );
}
