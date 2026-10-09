import type { ReactNode } from "react";
import type { CustomerStatusTone } from "../customer-status";
import { SetupMissingItems } from "./SetupMissingItems";
import { SetupStepStatusBadge } from "./SetupStepStatusBadge";

type SetupStepHeaderProps = {
  title: string;
  description: string;
  explanation?: string;
  status: CustomerStatusTone;
  statusLabel?: string;
  missingItems?: string[];
  children?: ReactNode;
};

export function SetupStepHeader({
  title,
  description,
  explanation,
  status,
  statusLabel,
  missingItems,
  children,
}: SetupStepHeaderProps) {
  return (
    <div className="setup-wizard__step-header">
      <div>
        <h3 className="setup-wizard__step-title">{title}</h3>
        <p className="setup-wizard__step-description">{description}</p>
        {explanation ? <p className="setup-step-why">{explanation}</p> : null}
        <SetupMissingItems items={missingItems} compact />
        {children}
      </div>
      <SetupStepStatusBadge status={status} label={statusLabel} />
    </div>
  );
}
