"use client";

import Link from "next/link";
import { encodeSiteId } from "../../lib/site-id";
import type { CustomerApiStatus, CustomerStatusStep } from "../customer/customer-status";

type ChecklistItem = {
  key: string;
  label: string;
  hint: string;
  href: string;
  stepKeys: string[];
};

function stateLabel(status: CustomerStatusStep | undefined) {
  if (!status) {
    return "Offen";
  }

  if (status.status === "complete") {
    return "Erledigt";
  }

  if (status.status === "blocked") {
    return "Blockiert";
  }

  return "Offen";
}

function stateClass(status: CustomerStatusStep | undefined) {
  if (status?.status === "complete") {
    return "setup-checklist__state setup-checklist__state--done";
  }

  if (status?.status === "blocked" || status?.status === "warning") {
    return "setup-checklist__state setup-checklist__state--attention";
  }

  return "setup-checklist__state";
}

function findStep(status: CustomerApiStatus | null, keys: string[]) {
  return status?.steps?.find((step) => keys.includes(step.key));
}

export function SetupReadinessChecklist({
  siteId,
  status,
}: {
  siteId: string;
  status: CustomerApiStatus | null;
}) {
  const siteSlug = encodeSiteId(siteId);
  const items: ChecklistItem[] = [
    {
      key: "basics",
      label: "Kundendaten",
      hint: "Firmenname, Website, Domain und Sprache sind hinterlegt.",
      href: `/sites/${siteSlug}/setup?step=customer#setup-step-basics`,
      stepKeys: ["basics"],
    },
    {
      key: "template",
      label: "KI-Mitarbeiter Profil",
      hint: "Ziel, Rolle und Antwortverhalten sind gesetzt.",
      href: `/sites/${siteSlug}/setup?step=bot#setup-step-industry`,
      stepKeys: ["template", "behavior"],
    },
    {
      key: "lead_delivery",
      label: "Anfrage-Zustellung",
      hint: "Lead-Erfassung und Empfänger-E-Mail sind eingerichtet.",
      href: `/sites/${siteSlug}/setup?step=delivery#setup-step-delivery`,
      stepKeys: ["lead_delivery"],
    },
    {
      key: "flow",
      label: "Gesprächslogik",
      hint: "Antworten, Rückfragen, Pflichtinformationen und Übergabe sind vorbereitet.",
      href: `/sites/${siteSlug}/setup?step=flow#setup-step-flow`,
      stepKeys: ["flow", "conversation_flow", "conversation_logic"],
    },
    {
      key: "knowledge",
      label: "Wissen vorhanden",
      hint: "Mindestens eine Wissensquelle ist bereit.",
      href: `/sites/${siteSlug}/setup?step=knowledge#setup-step-knowledge`,
      stepKeys: ["knowledge"],
    },
    {
      key: "design",
      label: "Design & Datenschutz",
      hint: "Begrüßung, Farbe, Datenschutzlink und Consent sind vorbereitet.",
      href: `/sites/${siteSlug}/setup?step=design#setup-step-design`,
      stepKeys: ["design"],
    },
    {
      key: "test",
      label: "Interner Test durchgeführt",
      hint: "Der KI-Mitarbeiter wurde intern geprüft.",
      href: `/sites/${siteSlug}/setup?step=launch#customer-test-chat`,
      stepKeys: ["test"],
    },
    {
      key: "embed",
      label: "Einbindung",
      hint: "Erlaubte Domains und Chatfenster-Code sind vorbereitet.",
      href: `/sites/${siteSlug}/embedding`,
      stepKeys: ["embed"],
    },
    {
      key: "live",
      label: "Review & Livegang",
      hint: status?.isLiveReady
        ? "Review ist fachlich vorbereitet. Der Livegang bleibt ein separater Freigabeschritt."
        : "Noch nicht bereit für Review und Livegang.",
      href: `/sites/${siteSlug}/setup?step=launch#setup-step-live`,
      stepKeys: ["live"],
    },
  ];

  return (
    <section className="dashboard-card dashboard-card--compact dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">Einrichtung & Review</h2>
        <p className="dashboard-copy dashboard-copy--muted">Was für einen sauberen Start noch fehlt.</p>
      </div>

      <div className="setup-checklist">
        {items.map((item) => {
          const step = findStep(status, item.stepKeys);
          const label = stateLabel(step);

          return (
            <Link key={item.key} href={item.href} className="setup-checklist__item">
              <span className={stateClass(step)}>{label}</span>
              <strong>{item.label}</strong>
              <small>{step?.missingReason || item.hint}</small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
