import type { ReactNode } from "react";

type SetupAdvancedDetailsProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function SetupAdvancedDetails({
  title = "Erweitert",
  description,
  children,
  className = "",
}: SetupAdvancedDetailsProps) {
  return (
    <details className={`dashboard-accordion setup-wizard__advanced${className ? ` ${className}` : ""}`}>
      <summary className="dashboard-accordion__summary">{title}</summary>
      <div className="dashboard-accordion__content dashboard-stack dashboard-stack--sm">
        {description ? <p className="dashboard-copy dashboard-copy--muted">{description}</p> : null}
        {children}
      </div>
    </details>
  );
}
