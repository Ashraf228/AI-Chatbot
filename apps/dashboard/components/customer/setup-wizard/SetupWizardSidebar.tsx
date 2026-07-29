import type { DashboardSessionRole } from "../../../lib/auth";
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

const ROLE_LABELS: Record<DashboardSessionRole, string> = {
  admin: "Admin",
  operator: "Operator",
  viewer: "Nur Ansicht",
  customer: "Kunde",
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
  const boundaryNotes = [
    dashboardRole === "admin" || dashboardRole === "operator"
      ? "Interner Testpfad nur für Admin und Operator."
      : "Interner Test bleibt verborgen, bis eine interne Rolle aktiv ist.",
    status?.lifecycleStatus === "live"
      ? "Production ist bereits aktiv. Setup bleibt trotzdem Review-orientiert."
      : "Kein Public Widget und keine Production-Aktivierung aus dem Setup.",
    status?.isLiveReady
      ? "Go-Live ist fachlich vorbereitet, aber weiterhin ein Review-Gate."
      : "Go-Live bleibt blockiert, bis alle fehlenden Schritte sauber geschlossen sind.",
  ];

  return (
    <aside className="setup-wizard__sidebar dashboard-stack">
      <section className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
        <strong>
          Schritt {activeStepIndex + 1} von {steps.length}
        </strong>
        <CompactMetricCard label="Startklar-Check" value={`${status?.progress ?? 0}%`} />
        <div className="setup-wizard__meta">
          <span>Rolle: {dashboardRole ? ROLE_LABELS[dashboardRole] : "Nicht zugeordnet"}</span>
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
        <h3 className="dashboard-card-title dashboard-card-title--sm">Boundary</h3>
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
