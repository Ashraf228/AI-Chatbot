import type { DashboardSessionRole } from "./auth";

export type DashboardRoleAccessView = "admin" | "operator" | "viewer" | "customer" | "unknown";

export type DashboardRoleCapability = {
  key: "configure" | "internal_test" | "knowledge" | "review" | "deploy" | "customer_data";
  label: string;
  allowed: boolean;
};

export type DashboardRoleAccess = {
  role: DashboardRoleAccessView;
  sourceRole: DashboardSessionRole | null;
  roleLabel: string;
  summary: string;
  description: string;
  isInternalRole: boolean;
  isEvaluationOnly: boolean;
  capabilities: DashboardRoleCapability[];
  boundaryBadges: string[];
  demoBoundaryCopy: string;
};

function capability(label: string, allowed: boolean, key: DashboardRoleCapability["key"]): DashboardRoleCapability {
  return { key, label, allowed };
}

export function getDashboardRoleAccess(role: DashboardSessionRole | null | undefined): DashboardRoleAccess {
  switch (role) {
    case "admin":
      return {
        role: "admin",
        sourceRole: role,
        roleLabel: "Admin",
        summary: "Interner Setup- und Testzugang",
        description:
          "Admin darf Workspace, Wissen und interne Testpfade konfigurieren. Deploy, Public Widget, Production und Kundendaten bleiben weiterhin gesperrt.",
        isInternalRole: true,
        isEvaluationOnly: false,
        capabilities: [
          capability("Konfigurieren", true, "configure"),
          capability("Interner Testchat", true, "internal_test"),
          capability("Wissen hinzufügen", true, "knowledge"),
          capability("Review sehen", true, "review"),
          capability("Deploy / Public Widget", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Interner Setup-/Testzugang",
          "Kein Deploy",
          "Kein Public Widget",
          "Keine Production-Aktivierung",
        ],
        demoBoundaryCopy:
          "Interne Rollen bleiben test-only. Auch mit Admin-Zugang gibt es hier keine Public-Widget-, Deploy- oder Production-Freigabe und keine Nutzung von Kundendaten.",
      };
    case "operator":
      return {
        role: "operator",
        sourceRole: role,
        roleLabel: "Operator",
        summary: "Interner Setup- und Testzugang",
        description:
          "Operator darf Workspace, Wissen und interne Testpfade konfigurieren. Deploy, Public Widget, Production und Kundendaten bleiben weiterhin gesperrt.",
        isInternalRole: true,
        isEvaluationOnly: false,
        capabilities: [
          capability("Konfigurieren", true, "configure"),
          capability("Interner Testchat", true, "internal_test"),
          capability("Wissen hinzufügen", true, "knowledge"),
          capability("Review sehen", true, "review"),
          capability("Deploy / Public Widget", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Interner Setup-/Testzugang",
          "Kein Deploy",
          "Kein Public Widget",
          "Keine Production-Aktivierung",
        ],
        demoBoundaryCopy:
          "Operator bleibt auf interne Setup-/Testflächen beschränkt. Kein Public Widget, kein Deploy, keine Production-Aktivierung und keine Nutzung von Kundendaten.",
      };
    case "viewer":
      return {
        role: "viewer",
        sourceRole: role,
        roleLabel: "Viewer",
        summary: "Evaluation / Read-only",
        description:
          "Viewer ist ein externer Demonstrationszugang ohne Konfigurationsrechte. Keine Agent-Konfiguration, kein Knowledge-Upload, kein interner Testpfad.",
        isInternalRole: false,
        isEvaluationOnly: true,
        capabilities: [
          capability("Konfigurieren", false, "configure"),
          capability("Interner Testchat", false, "internal_test"),
          capability("Wissen hinzufügen", false, "knowledge"),
          capability("Review sehen", false, "review"),
          capability("Deploy / Public Widget", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Evaluation / Read-only",
          "Keine Konfiguration",
          "Keine Kundendaten",
          "Keine Production",
        ],
        demoBoundaryCopy:
          "Externe Demo-Zugänge bleiben guided/evaluation only. Keine Konfiguration, keine echten Zugangsdaten, keine Kundendaten und keine Production-Systeme.",
      };
    case "customer":
      return {
        role: "customer",
        sourceRole: role,
        roleLabel: "Kunde",
        summary: "Site-gebundener Zugang ohne internen Setup-Status",
        description:
          "Dieser Zugang ist nicht als interner Admin-/Operator-Zugang markiert. Interne Testpfade, Public Widget, Deploy, Production und Kundendaten bleiben gesperrt.",
        isInternalRole: false,
        isEvaluationOnly: false,
        capabilities: [
          capability("Konfigurieren", false, "configure"),
          capability("Interner Testchat", false, "internal_test"),
          capability("Wissen hinzufügen", false, "knowledge"),
          capability("Review sehen", true, "review"),
          capability("Deploy / Public Widget", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Kein interner Setup-/Testzugang",
          "Kein Deploy",
          "Kein Public Widget",
          "Keine Kundendaten",
        ],
        demoBoundaryCopy:
          "Ohne internen Admin-/Operator-Status bleibt dieser Zugang auf einen konservativen Demo-/Review-Rahmen beschränkt. Keine Production-Freigabe und keine Nutzung von Kundendaten.",
      };
    default:
      return {
        role: "unknown",
        sourceRole: null,
        roleLabel: "Nicht eindeutig",
        summary: "Konservativer Zugriff ohne interne Freigabe",
        description:
          "Die Rolle konnte nicht sicher als Admin, Operator oder Viewer bestätigt werden. Deshalb wird kein interner Setup-, Test- oder Deploy-Zugang angenommen.",
        isInternalRole: false,
        isEvaluationOnly: false,
        capabilities: [
          capability("Konfigurieren", false, "configure"),
          capability("Interner Testchat", false, "internal_test"),
          capability("Wissen hinzufügen", false, "knowledge"),
          capability("Review sehen", false, "review"),
          capability("Deploy / Public Widget", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Rolle nicht eindeutig",
          "Keine interne Freigabe",
          "Kein Deploy",
          "Keine Kundendaten",
        ],
        demoBoundaryCopy:
          "Wenn die Rolle nicht sicher verfügbar ist, bleibt das Dashboard konservativ: keine Konfiguration, keine internen Testpfade, keine Kundendaten und keine Production-Freigabe.",
      };
  }
}
