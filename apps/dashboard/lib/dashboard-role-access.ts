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
          "Admin darf Einrichtung, Wissen und interne Testpfade konfigurieren. Deploy, oeffentliches Chatfenster, Produktivbetrieb und Kundendaten bleiben weiterhin gesperrt.",
        isInternalRole: true,
        isEvaluationOnly: false,
        capabilities: [
          capability("Konfigurieren", true, "configure"),
          capability("Interner Testchat", true, "internal_test"),
          capability("Wissen hinzufügen", true, "knowledge"),
          capability("Review sehen", true, "review"),
          capability("Deploy / Oeffentliches Chatfenster", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Interner Setup-/Testzugang",
          "Kein Deploy",
          "Kein Public Widget",
          "Keine Production-Aktivierung",
        ],
        demoBoundaryCopy:
          "Interne Rollen bleiben test-only. Auch mit Admin-Zugang gibt es hier keine Freigabe fuer oeffentliches Chatfenster, Deploy oder Produktivbetrieb und keine Nutzung von Kundendaten.",
      };
    case "operator":
      return {
        role: "operator",
        sourceRole: role,
        roleLabel: "Operator",
        summary: "Interner Setup- und Testzugang",
        description:
          "Operator darf Einrichtung, Wissen und interne Testpfade konfigurieren. Deploy, oeffentliches Chatfenster, Produktivbetrieb und Kundendaten bleiben weiterhin gesperrt.",
        isInternalRole: true,
        isEvaluationOnly: false,
        capabilities: [
          capability("Konfigurieren", true, "configure"),
          capability("Interner Testchat", true, "internal_test"),
          capability("Wissen hinzufügen", true, "knowledge"),
          capability("Review sehen", true, "review"),
          capability("Deploy / Oeffentliches Chatfenster", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Interner Setup-/Testzugang",
          "Kein Deploy",
          "Kein Public Widget",
          "Keine Production-Aktivierung",
        ],
        demoBoundaryCopy:
          "Operator bleibt auf interne Einrichtungs- und Testflaechen beschraenkt. Kein oeffentliches Chatfenster, kein Deploy, kein Produktivbetrieb und keine Nutzung von Kundendaten.",
      };
    case "viewer":
      return {
        role: "viewer",
        sourceRole: role,
        roleLabel: "Viewer",
        summary: "Evaluation / Nur Lesen",
        description:
          "Viewer ist ein externer Demo-Zugang ohne Konfigurationsrechte. Keine Einrichtung, kein Wissens-Upload und kein interner Testpfad.",
        isInternalRole: false,
        isEvaluationOnly: true,
        capabilities: [
          capability("Konfigurieren", false, "configure"),
          capability("Interner Testchat", false, "internal_test"),
          capability("Wissen hinzufügen", false, "knowledge"),
          capability("Review sehen", false, "review"),
          capability("Deploy / Oeffentliches Chatfenster", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Evaluation / Nur Lesen",
          "Keine Konfiguration",
          "Keine Kundendaten",
          "Kein Produktivbetrieb",
        ],
        demoBoundaryCopy:
          "Externe Demo-Zugaenge bleiben gefuehrt und nur zum Lesen. Keine Konfiguration, keine echten Zugangsdaten, keine Kundendaten und keine Produktivsysteme.",
      };
    case "customer":
      return {
        role: "customer",
        sourceRole: role,
        roleLabel: "Kunde",
        summary: "Site-gebundener Zugang ohne internen Setup-Status",
        description:
          "Dieser Zugang ist nicht als interner Admin-/Operator-Zugang markiert. Interne Testpfade, oeffentliches Chatfenster, Deploy, Produktivbetrieb und Kundendaten bleiben gesperrt.",
        isInternalRole: false,
        isEvaluationOnly: false,
        capabilities: [
          capability("Konfigurieren", false, "configure"),
          capability("Interner Testchat", false, "internal_test"),
          capability("Wissen hinzufügen", false, "knowledge"),
          capability("Review sehen", true, "review"),
          capability("Deploy / Oeffentliches Chatfenster", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Kein interner Setup-/Testzugang",
          "Kein Deploy",
          "Kein Public Widget",
          "Keine Kundendaten",
        ],
        demoBoundaryCopy:
          "Ohne internen Admin-/Operator-Status bleibt dieser Zugang auf einen konservativen Demo- und Review-Rahmen beschraenkt. Keine Freigabe fuer Produktivbetrieb und keine Nutzung von Kundendaten.",
      };
    default:
      return {
        role: "unknown",
        sourceRole: null,
        roleLabel: "Nicht eindeutig",
        summary: "Konservativer Zugriff ohne interne Freigabe",
        description:
          "Die Rolle konnte nicht sicher als Admin, Operator oder Viewer bestaetigt werden. Deshalb wird kein interner Einrichtungs-, Test- oder Deploy-Zugang angenommen.",
        isInternalRole: false,
        isEvaluationOnly: false,
        capabilities: [
          capability("Konfigurieren", false, "configure"),
          capability("Interner Testchat", false, "internal_test"),
          capability("Wissen hinzufügen", false, "knowledge"),
          capability("Review sehen", false, "review"),
          capability("Deploy / Oeffentliches Chatfenster", false, "deploy"),
          capability("Kundendaten nutzen", false, "customer_data"),
        ],
        boundaryBadges: [
          "Rolle nicht eindeutig",
          "Keine interne Freigabe",
          "Kein Deploy",
          "Keine Kundendaten",
        ],
        demoBoundaryCopy:
          "Wenn die Rolle nicht sicher verfuegbar ist, bleibt das Dashboard konservativ: keine Konfiguration, keine internen Testpfade, keine Kundendaten und keine Freigabe fuer Produktivbetrieb.",
      };
  }
}
