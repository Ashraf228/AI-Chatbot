"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "../shared/Button";

type ActionLink = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

type PrimaryActionPanelProps = {
  title?: string;
  description?: string;
  primaryAction: ActionLink;
  secondaryActions?: ActionLink[];
  liveAction?: ActionLink;
  liveBlockedReason?: string;
  feedback?: ReactNode;
};

function renderAction(action: ActionLink, variant: "primary" | "secondary" = "secondary") {
  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className={`dashboard-button dashboard-button--${variant}`}>
        {action.label}
      </Link>
    );
  }

  return (
    <Button type="button" variant={variant} onClick={action.onClick} disabled={action.disabled}>
      {action.label}
    </Button>
  );
}

export function PrimaryActionPanel({
  title = "Nächste Aktion",
  description = "Die wichtigsten Aktionen für Einrichtung und Betrieb.",
  primaryAction,
  secondaryActions = [],
  liveAction,
  liveBlockedReason,
  feedback,
}: PrimaryActionPanelProps) {
  return (
    <section className="primary-action-panel">
      <div className="primary-action-panel__main">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {renderAction(primaryAction, "primary")}
      </div>

      {secondaryActions.length > 0 ? (
        <div className="primary-action-panel__secondary">
          {secondaryActions.slice(0, 3).map((action) => (
            <span key={action.label}>{renderAction(action, "secondary")}</span>
          ))}
        </div>
      ) : null}

      {liveAction || liveBlockedReason ? (
        <div className="primary-action-panel__live">
          {liveAction ? renderAction(liveAction, "primary") : null}
          {liveBlockedReason ? <p>Noch nicht bereit für Go-Live: {liveBlockedReason}</p> : null}
        </div>
      ) : null}

      {feedback ? <div>{feedback}</div> : null}
    </section>
  );
}
