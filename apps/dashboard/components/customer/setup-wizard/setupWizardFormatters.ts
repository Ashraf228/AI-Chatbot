import { getStatusLabel } from "../../../lib/labels";
import type { KnowledgeSource } from "./setupWizardTypes";

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Noch nicht gesetzt";
  }

  return new Date(value).toLocaleString("de-DE");
}

export function createEmbedCode(loaderUrl: string, siteKey: string) {
  return `<script src="${loaderUrl}" data-site-key="${siteKey}" async></script>`;
}

export function dashboardStatusText(value: string | undefined) {
  if (!value) return "";
  return value
    .replace(/Lead-Empfänger-E-Mail/g, "Empfänger für neue Anfragen")
    .replace(/Lead-Zustellung/g, "Anfrage-Zustellung")
    .replace(/Firma & Domain/g, "Firma & Website")
    .replace(/Domain/g, "Website")
    .replace(/\bLeads\b/g, "Anfragen")
    .replace(/\bLead\b/g, "Anfrage");
}

export function statusLabel(source: KnowledgeSource) {
  if (!source.isActive || source.status === "disabled") {
    return getStatusLabel("disabled");
  }
  return getStatusLabel(source.status || "pending");
}

export function formatKnowledgeSourceType(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === "url_metadata") {
    return "Website-Metadatum";
  }
  if (normalized === "demo" || normalized === "test" || normalized === "synthetic") {
    return "Demo-/Testwissen";
  }
  if (normalized === "url" || normalized === "website") {
    return "Webseite (einzeln importiert)";
  }
  if (normalized === "pdf") {
    return "PDF";
  }
  if (normalized === "document") {
    return "Dokument";
  }
  if (normalized === "manual" || normalized === "faq" || normalized === "text") {
    return "Text";
  }
  return "Nicht eindeutig";
}

export function formatKnowledgeSourceStatus(status: string, isActive: boolean) {
  if (!isActive || status === "disabled") {
    return "Deaktiviert";
  }
  if (status === "ready" || status === "indexed") {
    return "Einsatzbereit";
  }
  if (status === "processing" || status === "pending") {
    return "Wird verarbeitet";
  }
  if (status === "failed" || status === "error") {
    return "Fehler";
  }
  return "Nicht eindeutig";
}

export function formatKnowledgeSourceUpdatedAt(value: string | null | undefined) {
  if (!value) {
    return "Noch nicht aktualisiert";
  }
  return `Aktualisiert am ${formatDate(value)}`;
}

export function formatReadinessStatus(status: string | undefined) {
  if (status === "complete") {
    return "Geprüft";
  }
  if (status === "ready") {
    return "Bereit";
  }
  if (status === "test_passed") {
    return "Test erfolgreich";
  }
  if (status === "blocked") {
    return "Blockiert";
  }
  if (status === "incomplete") {
    return "Unvollständig";
  }
  if (status === "test_missing") {
    return "Test fehlt noch";
  }
  if (status === "warning" || status === "missing") {
    return "Offen";
  }
  if (status === "disabled") {
    return "Nicht aktiv";
  }
  if (status === "live") {
    return "Live";
  }
  return "Offen";
}

export function formatLaunchStatus(isLive: boolean, canGoLive: boolean) {
  if (isLive) {
    return "Live";
  }
  if (canGoLive) {
    return "Bereit";
  }
  return "Noch offen";
}

export function getReadinessItemHint(missingReason?: string, nextActionLabel?: string) {
  if (missingReason) {
    return dashboardStatusText(missingReason);
  }
  if (nextActionLabel) {
    return dashboardStatusText(nextActionLabel);
  }
  return "Dieser Punkt ist noch nicht vollständig geprüft.";
}
