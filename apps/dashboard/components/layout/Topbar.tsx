import { BrandLogo } from "./BrandLogo";

export function Topbar({ title }: { title: string }) {
  return (
    <header
      style={{
        padding: "20px 24px",
        borderBottom: "1px solid rgba(28,25,23,0.08)",
        background: "rgba(255,255,255,0.58)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <div
          style={{
            marginBottom: 4,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#78716c",
          }}
        >
          Soulé Dashboard
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#1c1917" }}>{title}</h1>
      </div>
      <BrandLogo size={42} showWordmark={false} />
    </header>
  );
}
