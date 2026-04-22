import { BrandLogo } from "./BrandLogo";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="dashboard-topbar">
      <div>
        <div className="dashboard-eyebrow">Soulé Dashboard</div>
        <h1 className="dashboard-title">{title}</h1>
      </div>
      <BrandLogo size={42} showWordmark={false} />
    </header>
  );
}
