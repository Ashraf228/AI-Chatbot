import { CustomerStatusBadge } from "../CustomerStatusBadge";
import {
  mapOverallStatusToTone,
  mapStatusSeverityToTone,
  type CustomerApiStatus,
  type CustomerOverallStatus,
  type CustomerStatusStepState,
} from "../customer-status";
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
  const stepByKey = new Map(steps.map((step) => [step.key, step] as const));
  const missingItems = missingSteps
    .map((key) => steps.find((step) => step.key === key))
    .filter((step): step is NonNullable<typeof step> => Boolean(step));
  const templateStep = stepByKey.get("template");
  const behaviorStep = stepByKey.get("behavior");
  const knowledgeStep = stepByKey.get("knowledge");
  const designStep = stepByKey.get("design");
  const testStep = stepByKey.get("test");
  const liveStep = stepByKey.get("live");
  const designMissingReason = designStep?.missingReason || "";
  const privacyMissing = designMissingReason.toLowerCase().includes("datenschutz");

  const reviewItems = [
    {
      key: "template",
      jumpKey: templateStep?.key || "template",
      label: "Agent / Template",
      step: templateStep,
      hint: "Profil, Rolle und Setup-Grundlage sind intern geprüft.",
    },
    {
      key: "behavior",
      jumpKey: behaviorStep?.key || "behavior",
      label: "Gesprächslogik / Verhalten",
      step: behaviorStep,
      hint: "Antwortlogik, Rückfragen und Pflichtinformationen bleiben getrennt von technischen Diagnosen.",
    },
    {
      key: "design",
      jumpKey: designStep?.key || "design",
      label: "Design",
      step: designStep
        ? {
            ...designStep,
            status: privacyMissing && designStep.status === "warning" ? "complete" : designStep.status,
            missingReason: privacyMissing ? "Design ist gespeichert." : designStep.missingReason,
          }
        : undefined,
      hint: "Button, Farben und visuelle Einbindung sind Teil des Review-Flows.",
    },
    {
      key: "privacy",
      jumpKey: designStep?.key || "design",
      label: "Datenschutz",
      step: designStep
        ? {
            ...designStep,
            status: designStep.status === "complete" ? "complete" : privacyMissing ? "warning" : "incomplete",
            missingReason: privacyMissing ? designMissingReason : designStep.status === "complete" ? "Datenschutz ist gespeichert." : "Datenschutz ist noch nicht vollständig geprüft.",
          }
        : undefined,
      hint: "Datenschutz bleibt Pflichtgrenze vor jedem späteren Livegang.",
    },
    {
      key: "knowledge",
      jumpKey: knowledgeStep?.key || "knowledge",
      label: "Wissen / Demo-Wissen",
      step: knowledgeStep,
      hint: "Demo-Wissen bleibt intern und aktiviert weder Kundendaten noch Persistenz.",
    },
    {
      key: "test",
      jumpKey: testStep?.key || "test",
      label: "Interner Test",
      step: testStep,
      hint: "Nur interner Testpfad. Keine echten Tickets, E-Mails oder Webhooks.",
    },
    {
      key: "live",
      jumpKey: liveStep?.key || "live",
      label: "Livegang / Aktivierung",
      step: liveStep
        ? {
            ...liveStep,
            status: liveStep.status === "complete" ? "complete" : "blocked",
            missingReason: liveStep.missingReason || "Livegang bleibt in diesem P0-Schritt gesperrt.",
          }
        : undefined,
      hint: "Deploy, Public Widget und Production-Aktivierung bleiben separat gesperrt.",
    },
  ];

  function resolvedStepStatus(stepStatus?: string): CustomerStatusStepState {
    if (stepStatus === "complete" || stepStatus === "warning" || stepStatus === "blocked") {
      return stepStatus;
    }

    return "incomplete";
  }

  function reviewStatusLabel(stepStatus?: string) {
    if (stepStatus === "complete") {
      return "Bereit";
    }
    if (stepStatus === "blocked") {
      return "Blockiert";
    }
    return "Unvollständig";
  }

  return (
    <div className="setup-module-card launch-step__readiness dashboard-stack dashboard-stack--sm">
      <div className="dashboard-info-row">
        <div>
          <h3 className="dashboard-card-title dashboard-card-title--sm">Setup-Review</h3>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Dieser Schritt bündelt den aktuellen Setup-Stand, interne Tests und klare Aktivierungsgrenzen für den späteren Livegang.
          </p>
        </div>
        <CustomerStatusBadge
          status={status ? mapStatusSeverityToTone(status.severity) : mapOverallStatusToTone(overallStatus)}
          label={formatLaunchStatus(isLive, canGoLive)}
        />
      </div>

      {reviewItems.length ? (
        <div className="dashboard-grid dashboard-grid--two">
          {reviewItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="dashboard-link-card"
              onClick={() => onJumpToStatusStep(item.jumpKey)}
            >
              <span>{dashboardStatusText(item.label)}</span>
              <CustomerStatusBadge
                status={mapStepStatusToTone(resolvedStepStatus(item.step?.status))}
                label={reviewStatusLabel(item.step?.status)}
              />
              <span className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                {dashboardStatusText(getReadinessItemHint(item.step?.missingReason, item.hint))}
              </span>
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
        <p className="dashboard-status dashboard-status--success dashboard-no-margin-bottom">
          Interner Review-Stand vollständig. Livegang, Public Widget und Deploy bleiben dennoch separat gesperrt.
        </p>
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

      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
        Guided customer demo, self-service demo und real pilot bleiben außerhalb dieses Schritts blockiert.
      </p>
    </div>
  );
}
