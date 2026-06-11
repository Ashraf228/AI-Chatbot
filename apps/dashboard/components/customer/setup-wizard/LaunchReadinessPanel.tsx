import { CustomerStatusBadge } from "../CustomerStatusBadge";
import { mapOverallStatusToTone, mapStatusSeverityToTone, type CustomerApiStatus, type CustomerOverallStatus } from "../customer-status";
import { dashboardStatusText, formatLaunchStatus, formatReadinessStatus, getReadinessItemHint } from "./setupWizardFormatters";
import { mapStepStatusToTone } from "./setupWizardValidation";

type LaunchReadinessPanelProps = {
  status: CustomerApiStatus | null;
  overallStatus: CustomerOverallStatus | string;
  canGoLive: boolean;
  isLive: boolean;
  onJumpToStatusStep: (stepKey?: string) => void;
};

export function LaunchReadinessPanel({
  status,
  overallStatus,
  canGoLive,
  isLive,
  onJumpToStatusStep,
}: LaunchReadinessPanelProps) {
  const missingSteps = status?.missingSteps || [];
  const steps = status?.steps || [];
  const missingItems = missingSteps
    .map((key) => steps.find((step) => step.key === key))
    .filter((step): step is NonNullable<typeof step> => Boolean(step));

  return (
    <div className="setup-module-card launch-step__readiness dashboard-stack dashboard-stack--sm">
      <div className="dashboard-info-row">
        <div>
          <h3 className="dashboard-card-title dashboard-card-title--sm">Startklar-Check</h3>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Das System prüft, ob Test, Datenschutz, Wissen und Einbindung bereit sind.
          </p>
        </div>
        <CustomerStatusBadge
          status={status ? mapStatusSeverityToTone(status.severity) : mapOverallStatusToTone(overallStatus)}
          label={formatLaunchStatus(isLive, canGoLive)}
        />
      </div>

      {steps.length ? (
        <div className="dashboard-grid dashboard-grid--two">
          {steps.map((step) => (
            <button
              key={step.key}
              type="button"
              className="dashboard-link-card"
              onClick={() => onJumpToStatusStep(step.key)}
            >
              <span>{dashboardStatusText(step.label)}</span>
              <CustomerStatusBadge status={mapStepStatusToTone(step.status)} label={formatReadinessStatus(step.status)} />
            </button>
          ))}
        </div>
      ) : null}

      {missingItems.length ? (
        <div className="dashboard-status dashboard-status--warning">
          <strong>Noch offen:</strong>{" "}
          {missingItems.map((item) => dashboardStatusText(item.label)).join(", ")}
        </div>
      ) : (
        <p className="dashboard-status dashboard-status--success dashboard-no-margin-bottom">Bereit: Die wichtigsten Punkte sind geprüft.</p>
      )}

      {missingItems.length ? (
        <div className="dashboard-stack dashboard-stack--xs">
          {missingItems.map((item) => (
            <p key={item.key} className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              {dashboardStatusText(item.label)}: {getReadinessItemHint(item.missingReason, item.nextAction?.label)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
