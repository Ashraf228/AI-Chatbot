import type { DashboardSessionRole } from "../../../lib/auth";
import { getDashboardRoleAccess } from "../../../lib/dashboard-role-access";
import type { CustomerApiStatus, CustomerStatusStep } from "../customer-status";
import { CompactMetricCard } from "../../shared/CompactMetricCard";
import { SetupReadinessChecklist } from "../../sites/SetupReadinessChecklist";
import { STATUS_STEP_GROUPS } from "./setupWizardConstants";
import { dashboardStatusText } from "./setupWizardFormatters";
import { statusForWizardStep, wizardStepStatusLabel } from "./setupWizardValidation";
import type { WizardStep, WizardStepKey } from "./setupWizardTypes";
import { SetupStepStatusBadge } from "./SetupStepStatusBadge";

type SetupWizardSidebarProps = {
  siteId: string;
  steps: WizardStep[];
  activeStepIndex: number;
  status: CustomerApiStatus | null;
  dashboardRole?: DashboardSessionRole | null;
  onStepChange: (index: number) => void;
};

function missingLabels(status: CustomerApiStatus | null, step: WizardStepKey) {
  const missing = status?.missingSteps ?? [];
  const stepKeys = STATUS_STEP_GROUPS[step] ?? [];
  if (missing.length === 0) {
    return [];
  }

  return missing
    .filter((key) => stepKeys.includes(key))
    .map((key) => status?.steps?.find((entry) => entry.key === key))
    .filter((entry): entry is CustomerStatusStep => Boolean(entry?.label))
    .map((entry) => dashboardStatusText(entry.label))
    .filter(Boolean);
}

export function SetupWizardSidebar({
  siteId,
  steps,
  activeStepIndex,
  status,
  dashboardRole = null,
  onStepChange,
}: SetupWizardSidebarProps) {
  const roleAccess = getDashboardRoleAccess(dashboardRole);
  const boundaryNotes = [
    roleAccess.isInternalRole
      ? "Interner Testpfad bleibt nur für Admin und Operator offen."
      : "Kein interner Setup-/Testzugang bestätigt. Der Zustand bleibt konservativ.",
    status?.lifecycleStatus === "live"
      ? "Der Produktivbetrieb ist bereits aktiv. Die Einrichtung bleibt trotzdem review-orientiert."
      : "Kein oeffentliches Chatfenster und kein Produktivbetrieb aus der Einrichtung.",
    status?.isLiveReady
      ? "Der Livegang ist fachlich vorbereitet, bleibt aber weiterhin ein Review-Gate."
      : "Der Livegang bleibt blockiert, bis alle fehlenden Schritte sauber geschlossen sind.",
    roleAccess.demoBoundaryCopy,
  ];

  return (
    <aside className="setup-wizard__sidebar dashboard-stack">
      <section className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
        <strong>
          Schritt {activeStepIndex + 1} von {steps.length}
        </strong>
        <CompactMetricCard label="Startklar-Check" value={`${status?.progress ?? 0}%`} />
        <div className="setup-wizard__meta">
          <span>Rolle: {roleAccess.roleLabel}</span>
          <span>Nächster Fokus: {status?.nextAction?.label || steps[activeStepIndex]?.label}</span>
        </div>
      </section>

      <section className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
        <h3 className="dashboard-card-title dashboard-card-title--sm">Schritte</h3>
        <div className="dashboard-setup-steps dashboard-setup-steps--compact">
          {steps.map((step, index) => {
            const isActive = index === activeStepIndex;
            const missing = missingLabels(status, step.key);
            return (
              <button
                key={step.key}
                type="button"
                className={`dashboard-setup-step${isActive ? " dashboard-setup-step--active" : ""}`}
                onClick={() => onStepChange(index)}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="dashboard-setup-step__number">{index + 1}</span>
                <span>
                  <strong>{step.label}</strong>
                  <span>{step.description}</span>
                  {missing.length ? <small>{missing.slice(0, 2).join(", ")}</small> : null}
                </span>
                <SetupStepStatusBadge
                  status={statusForWizardStep(status, step.key)}
                  label={wizardStepStatusLabel(status, step.key)}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
        <h3 className="dashboard-card-title dashboard-card-title--sm">Rolle & Grenzen</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">{roleAccess.description}</p>
        <div className="setup-wizard__capability-list" aria-label="Rollenfähigkeiten">
          {roleAccess.capabilities.map((capability) => (
            <span
              key={capability.key}
              className={capability.allowed ? "dashboard-status dashboard-status--success" : "dashboard-badge"}
            >
              {capability.label}: {capability.allowed ? "Ja" : "Nein"}
            </span>
          ))}
        </div>
        <div className="setup-wizard__boundary-list">
          {boundaryNotes.map((note) => (
            <p key={note} className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              {note}
            </p>
          ))}
        </div>
      </section>

      <SetupReadinessChecklist siteId={siteId} status={status} />
    </aside>
  );
}
