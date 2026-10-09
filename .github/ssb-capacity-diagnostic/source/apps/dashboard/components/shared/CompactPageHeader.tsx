import type { ReactNode } from "react";

type CompactPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function CompactPageHeader({ eyebrow, title, description, actions }: CompactPageHeaderProps) {
  return (
    <section className="compact-page-header">
      <div>
        {eyebrow ? <p className="compact-page-header__eyebrow">{eyebrow}</p> : null}
        <h2 className="compact-page-header__title">{title}</h2>
        {description ? <p className="compact-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="compact-page-header__actions">{actions}</div> : null}
    </section>
  );
}
