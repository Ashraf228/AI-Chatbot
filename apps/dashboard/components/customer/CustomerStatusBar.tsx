"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DashboardSessionRole } from "../../lib/auth";
import { findSiteWorkspaceLocation, type SiteNavGroup } from "../../lib/dashboard-config";
import { encodeSiteId } from "../../lib/site-id";
import { resolveWidgetLoaderUrl } from "../../lib/widget-loader-url";
import { Button } from "../shared/Button";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import { mapStatusSeverityToTone, type CustomerApiStatus } from "./customer-status";

type CustomerStatusBarProps = {
  siteId: string;
  dashboardRole?: DashboardSessionRole | null;
  groups: SiteNavGroup[];
};

type SiteDetails = {
  name: string;
  siteKey: string;
  allowedDomains: string[];
  goLiveAt: string;
};

function toPreviewUrl(domain: string) {
  if (!domain) {
    return "";
  }

  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    return domain;
  }

  return `https://${domain}`;
}

function localNextHref(siteId: string, status: CustomerApiStatus | null) {
  const siteSlug = encodeSiteId(siteId);
  const firstMissing = status?.missingSteps?.[0];

  if (firstMissing === "knowledge") {
    return `/sites/${siteSlug}/setup?step=knowledge#setup-step-knowledge`;
  }

  if (firstMissing === "behavior") {
    return `/sites/${siteSlug}/setup?step=flow#setup-step-flow`;
  }

  if (firstMissing === "design") {
    return `/sites/${siteSlug}/setup?step=design#setup-step-design`;
  }

  if (firstMissing === "embed") {
    return `/sites/${siteSlug}/setup?step=launch#setup-step-live`;
  }

  if (firstMissing === "test") {
    return `/sites/${siteSlug}/setup?step=launch#customer-test-chat`;
  }

  return `/sites/${siteSlug}/setup?step=customer#setup-step-basics`;
}

function primaryAction(siteId: string, status: CustomerApiStatus | null, site: SiteDetails | null) {
  const siteSlug = encodeSiteId(siteId);
  const isLive = Boolean(site?.goLiveAt || status?.lifecycleStatus === "live");

  if (isLive) {
    return { label: "Chat testen", href: `/sites/${siteSlug}/setup?step=launch#customer-test-chat` };
  }

  if ((status?.knowledgeCount ?? 0) === 0 || status?.missingSteps?.includes("knowledge")) {
    return { label: "Wissen hinzufügen", href: `/sites/${siteSlug}/setup?step=knowledge#setup-step-knowledge` };
  }

  return { label: "Setup fortsetzen", href: localNextHref(siteId, status) };
}

const ROLE_LABELS: Record<DashboardSessionRole, string> = {
  admin: "Admin",
  operator: "Operator",
  viewer: "Nur Ansicht",
  customer: "Kunde",
};

function roleLabel(role: DashboardSessionRole | null | undefined) {
  return role ? ROLE_LABELS[role] : "Nicht zugeordnet";
}

export function CustomerStatusBar({ siteId, dashboardRole = null, groups }: CustomerStatusBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [status, setStatus] = useState<CustomerApiStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [loaderUrl, setLoaderUrl] = useState(
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js",
  );

  useEffect(() => {
    setLoaderUrl(resolveWidgetLoaderUrl(process.env.NEXT_PUBLIC_WIDGET_LOADER_URL));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    async function load() {
      const [siteResponse, statusResponse] = await Promise.all([
        fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" }),
        fetch(`/api/sites/${siteId}/status`, { cache: "no-store" }),
      ]);
      const siteData = await siteResponse.json().catch(() => ({}));
      const statusData = await statusResponse.json().catch(() => ({}));

      if (siteResponse.ok) {
        setSite({
          name: siteData.name || siteId,
          siteKey: siteData.siteKey || "",
          allowedDomains: Array.isArray(siteData.allowedDomains) ? siteData.allowedDomains : [],
          goLiveAt: siteData.goLiveAt || "",
        });
      }

      if (statusResponse.ok && statusData?.status) {
        setStatus(statusData);
      }
    }

    load();
  }, [siteId]);

  const embedCode = useMemo(() => {
    if (!site?.siteKey) {
      return "";
    }

    return `<script src="${loaderUrl}" data-site-key="${site.siteKey}" defer></script>`;
  }, [loaderUrl, site?.siteKey]);
  const domain = site?.allowedDomains?.[0] || "";
  const previewUrl = toPreviewUrl(domain);
  const isLive = Boolean(site?.goLiveAt || status?.lifecycleStatus === "live");
  const mainAction = primaryAction(siteId, status, site);
  const liveBlockedReason = status && !status.isLiveReady && !isLive ? status.nextAction?.label || status.label : "";
  const { activeGroup, activeItem } = findSiteWorkspaceLocation(
    groups,
    siteSlug,
    pathname,
    searchParams.toString(),
    hash,
  );
  const activeAreaLabel = activeItem?.label || activeGroup?.label || "Übersicht";
  const activeAreaDescription = activeItem?.description || activeGroup?.description || "Aktueller Workspace-Bereich.";
  const boundaryLabels = [
    dashboardRole === "admin" || dashboardRole === "operator" ? "Interner Testpfad verfügbar" : "Interner Test bleibt intern",
    isLive ? "Production aktiv" : "Production nicht aktiviert",
    isLive ? "Public Widget aktiv" : "Public Widget nicht aktiviert",
    isLive ? "Betrieb beobachten" : "Go-Live nur nach Review",
  ];

  async function copyEmbedCode() {
    if (!embedCode) {
      setError("Einbindungscode fehlt noch.");
      return;
    }

    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setError("");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Einbindungscode konnte nicht kopiert werden.");
    }
  }

  return (
    <section className="customer-status-bar">
      <div className="customer-status-bar__identity">
        <p>Aktiver Workspace</p>
        <h2>{site?.name || siteId}</h2>
        <div className="customer-status-bar__context">
          <span>Site: {siteId}</span>
          <span>Bereich: {activeAreaLabel}</span>
          <span>Rolle: {roleLabel(dashboardRole)}</span>
        </div>
        <span>{domain || "Keine Domain hinterlegt"}</span>
      </div>

      <div className="customer-status-bar__states">
        <CustomerStatusBadge
          status={status ? mapStatusSeverityToTone(status.severity) : "pending"}
          label={status?.label || "Status wird geladen"}
        />
        <span className={isLive ? "dashboard-status dashboard-status--success" : "dashboard-badge"}>
          {isLive ? "Live" : "Nicht live"}
        </span>
        <span className={site?.siteKey ? "dashboard-status dashboard-status--success" : "dashboard-badge"}>
          {site?.siteKey ? "Widget bereit" : "Einbindung fehlt"}
        </span>
      </div>

      <div className="customer-status-bar__next">
        <span>Aktiver Fokus</span>
        <strong>{activeAreaLabel}</strong>
        <small>{activeAreaDescription}</small>
      </div>

      <div className="customer-status-bar__next">
        <span>Nächster Schritt</span>
        <strong>{isLive ? "Betrieb prüfen" : status?.nextAction?.label || mainAction.label}</strong>
        <small>{isLive ? "Live-Betrieb beobachten und Testpfad sauber halten." : "Setup bleibt Source of Truth bis zum Review-Gate."}</small>
      </div>

      <div className="customer-status-bar__boundaries" aria-label="Workspace-Grenzen">
        {boundaryLabels.map((label) => (
          <span key={label} className="dashboard-badge">
            {label}
          </span>
        ))}
      </div>

      <div className="customer-status-bar__actions">
        <Link href={mainAction.href} className="dashboard-button dashboard-button--primary">
          {mainAction.label}
        </Link>
        <Button type="button" variant="secondary" onClick={copyEmbedCode}>
          Widget-Code kopieren
        </Button>
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="dashboard-button dashboard-button--secondary">
            Vorschau öffnen
          </a>
        ) : null}
        <Link href={`/sites/${siteSlug}/analytics`} className="dashboard-button dashboard-button--secondary">
          Analytics ansehen
        </Link>
      </div>

      {liveBlockedReason ? (
        <p className="customer-status-bar__hint">
          Noch nicht bereit für Go-Live: {liveBlockedReason}. Kein Public Widget, kein Self-Service und keine Production-Aktivierung aus diesem Stand.
        </p>
      ) : null}
      {copied ? <p className="dashboard-status dashboard-status--success">Einbindungscode kopiert.</p> : null}
      {error ? <p className="dashboard-status dashboard-status--error">{error}</p> : null}
    </section>
  );
}
