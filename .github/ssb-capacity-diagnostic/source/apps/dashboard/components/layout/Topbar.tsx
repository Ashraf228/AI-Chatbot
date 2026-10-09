import { BrandLogo } from "./BrandLogo";
import { Button } from "../shared/Button";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="dashboard-topbar">
      <div>
        <div className="dashboard-eyebrow">Soulé Dashboard</div>
        <h1 className="dashboard-title">{title}</h1>
      </div>
      <div className="dashboard-topbar-actions">
        <form action="/api/auth/logout" method="POST">
          <Button type="submit" variant="secondary">
            Abmelden
          </Button>
        </form>
        <BrandLogo size={42} showWordmark={false} />
      </div>
    </header>
  );
}
