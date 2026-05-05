export type CustomerSetupSnapshot = {
  name: string;
  allowedDomains: string[];
  industry: string;
  setupGoal: string;
  siteKey: string;
  logoUrl?: string;
  brandColor?: string;
  welcomeMessage?: string;
  knowledgeCount: number;
  lastTestedAt?: string;
  goLiveAt?: string;
  hasError?: boolean;
};

export type CustomerOverallStatus =
  | "Setup unvollständig"
  | "Wissen fehlt"
  | "Design fehlt"
  | "Einbindung fehlt"
  | "Test erforderlich"
  | "Bereit für Live"
  | "Live"
  | "Fehler";

export function isDesignConfigured(snapshot: CustomerSetupSnapshot) {
  return Boolean(
    snapshot.logoUrl ||
      (snapshot.brandColor && snapshot.brandColor !== "#b55400") ||
      (snapshot.welcomeMessage && snapshot.welcomeMessage !== "Hi! Wie kann ich helfen?"),
  );
}

export function resolveCustomerOverallStatus(
  snapshot: CustomerSetupSnapshot,
): CustomerOverallStatus {
  if (snapshot.hasError) {
    return "Fehler";
  }

  if (snapshot.goLiveAt) {
    return "Live";
  }

  const basicsDone = Boolean(
    snapshot.name.trim() &&
      snapshot.allowedDomains.length > 0 &&
      snapshot.industry &&
      snapshot.setupGoal,
  );

  if (!basicsDone) {
    return "Setup unvollständig";
  }

  if (snapshot.knowledgeCount === 0) {
    return "Wissen fehlt";
  }

  if (!isDesignConfigured(snapshot)) {
    return "Design fehlt";
  }

  if (!snapshot.siteKey || snapshot.allowedDomains.length === 0) {
    return "Einbindung fehlt";
  }

  if (!snapshot.lastTestedAt) {
    return "Test erforderlich";
  }

  return "Bereit für Live";
}

export function mapOverallStatusToTone(status: CustomerOverallStatus) {
  if (status === "Live" || status === "Bereit für Live") {
    return "done" as const;
  }

  if (status === "Fehler") {
    return "attention" as const;
  }

  return "pending" as const;
}
