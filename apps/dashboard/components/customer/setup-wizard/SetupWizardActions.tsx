import type { ReactNode } from "react";
import { Button } from "../../shared/Button";

type SetupWizardActionsProps = {
  onBack?: () => void;
  onSave?: () => void;
  onSkip?: () => void;
  onPrimary?: () => void;
  backLabel?: string;
  saveLabel?: string;
  skipLabel?: string;
  primaryLabel: string;
  isSaving?: boolean;
  backDisabled?: boolean;
  saveDisabled?: boolean;
  skipDisabled?: boolean;
  primaryDisabled?: boolean;
  children?: ReactNode;
};

export function SetupWizardActions({
  onBack,
  onSave,
  onSkip,
  onPrimary,
  backLabel = "Zurück",
  saveLabel = "Speichern",
  skipLabel = "Später erledigen",
  primaryLabel,
  isSaving = false,
  backDisabled = false,
  saveDisabled = false,
  skipDisabled = false,
  primaryDisabled = false,
  children,
}: SetupWizardActionsProps) {
  return (
    <section className="dashboard-card dashboard-card--compact setup-wizard__actions">
      {onBack ? (
        <Button type="button" variant="secondary" onClick={onBack} disabled={backDisabled || isSaving}>
          {backLabel}
        </Button>
      ) : null}
      <div className="dashboard-inline dashboard-wrap">
        {children}
        {onSave ? (
          <Button type="button" variant="secondary" onClick={onSave} disabled={saveDisabled || isSaving}>
            {isSaving ? "Speichert..." : saveLabel}
          </Button>
        ) : null}
        {onSkip ? (
          <Button type="button" variant="secondary" onClick={onSkip} disabled={skipDisabled || isSaving}>
            {skipLabel}
          </Button>
        ) : null}
        {onPrimary ? (
          <Button type="button" onClick={onPrimary} disabled={primaryDisabled || isSaving}>
            {primaryLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
