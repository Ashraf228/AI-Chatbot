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
      label: "Unternehmensdaten vollständig",
      hint: "Name und Domain sind hinterlegt.",
      href: `/sites/${siteSlug}/setup`,
      stepKeys: ["basics"],
    },
    {
      key: "template",
      label: "Branche/Ziel gewählt",
      hint: "Vorlage und Bot-Ziel sind gesetzt.",
      href: `/sites/${siteSlug}/setup`,
      stepKeys: ["template", "behavior"],
    },
    {
      key: "knowledge",
      label: "Wissen vorhanden",
      hint: "Mindestens eine Wissensquelle ist bereit.",
      href: `/sites/${siteSlug}/knowledge`,
      stepKeys: ["knowledge"],
    },
    {
      key: "design",
      label: "Design geprüft",
      hint: "Begrüßung, Farbe und Datenschutz sind vorbereitet.",
      href: `/sites/${siteSlug}/branding`,
      stepKeys: ["design"],
    },
    {
      key: "test",
      label: "Testfrage gesendet",
      hint: "Der Bot wurde intern geprüft.",
      href: `/sites/${siteSlug}#customer-test-chat`,
      stepKeys: ["test"],
    },
    {
      key: "embed",
      label: "Einbindung geprüft",
      hint: "Domain und Widget-Code sind bereit.",
      href: `/sites/${siteSlug}/embedding`,
      stepKeys: ["embed"],
    },
    {
      key: "live",
      label: "Bereit für Go-Live",
      hint: status?.isLiveReady ? "Kunde kann live geschaltet werden." : "Noch nicht bereit für Go-Live.",
      href: `/sites/${siteSlug}/setup`,
      stepKeys: ["live"],
    },
  ];

  return (
    <section className="dashboard-card dashboard-card--compact dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">Einrichtung & Go-Live</h2>
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
