import type { ReactNode } from "react";

type SetupWizardShellProps = {
  title: string;
  description: string;
  sidebar: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function SetupWizardShell({
  title,
  description,
  sidebar,
  children,
  actions,
  className = "",
}: SetupWizardShellProps) {
  return (
    <div className={`setup-wizard setup-wizard__shell${className ? ` ${className}` : ""}`}>
      <main className="setup-wizard__content dashboard-stack">
        <section className="dashboard-card dashboard-card--compact dashboard-stack">
          <div>
            <h2 className="dashboard-card-title">{title}</h2>
            <p className="dashboard-copy dashboard-copy--muted">{description}</p>
          </div>
        </section>
        {children}
        {actions}
      </main>
      {sidebar}
    </div>
  );
}
