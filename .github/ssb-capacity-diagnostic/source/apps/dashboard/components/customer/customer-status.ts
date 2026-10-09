export type CustomerStatusSeverity = "success" | "warning" | "error" | "neutral" | "info";

export type CustomerStatusTone = "done" | "pending" | "attention";

export type CustomerOverallStatus =
  | "Setup unvollständig"
  | "Wissen fehlt"
  | "Design fehlt"
  | "Einbindung fehlt"
  | "Datenschutz-URL fehlt"
  | "Test erforderlich"
  | "Bereit für Live"
  | "Live"
  | "Pausiert"
  | "Fehler";

export type CustomerStatusStepKey =
  | "basics"
  | "template"
  | "knowledge"
  | "behavior"
  | "design"
  | "embed"
  | "test"
  | "live"
  | string;

export type CustomerStatusStepState = "complete" | "incomplete" | "warning" | "blocked";

export type CustomerStatusAction = {
  key?: string;
  label: string;
  href?: string;
};

export type CustomerStatusStep = {
  key: CustomerStatusStepKey;
  label: string;
  status: CustomerStatusStepState;
  missingReason?: string;
  nextAction?: {
    label: string;
    href?: string;
  };
};

export type CustomerApiStatus = {
  siteId: string;
  code: string;
  label: CustomerOverallStatus | string;
  status: CustomerOverallStatus | string;
  severity: CustomerStatusSeverity;
  progress: number;
  lifecycleStatus:
    | "draft"
    | "setup_incomplete"
    | "ready_for_test"
    | "ready_for_live"
    | "live"
    | "paused"
    | "error";
  isLiveReady: boolean;
  missingSteps: string[];
  nextAction?: CustomerStatusAction;
  steps: CustomerStatusStep[];
  knowledgeCount: number;
  industry: string;
  setupGoal: string;
  lastTestedAt: string;
  goLiveAt: string;
};

export function mapStatusSeverityToTone(severity: CustomerStatusSeverity): CustomerStatusTone {
  if (severity === "success") {
    return "done";
  }

  if (severity === "error") {
    return "attention";
  }

  return "pending";
}

export function mapOverallStatusToTone(status: CustomerOverallStatus | string): CustomerStatusTone {
  if (status === "Live" || status === "Bereit für Live") {
    return "done";
  }

  if (status === "Fehler" || status === "Datenschutz-URL fehlt") {
    return "attention";
  }

  return "pending";
}
