export type CustomerStatusSeverity = "success" | "warning" | "error" | "info";

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

export type CustomerApiStatus = {
  siteId: string;
  code: string;
  label: CustomerOverallStatus | string;
  status: CustomerOverallStatus | string;
  severity: CustomerStatusSeverity;
  progress: number;
  lifecycleStatus: "draft" | "setup_incomplete" | "ready_for_test" | "live" | "paused" | "error";
  isLiveReady: boolean;
  missingSteps: string[];
  nextAction?: {
    label: string;
    href: string;
  };
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
