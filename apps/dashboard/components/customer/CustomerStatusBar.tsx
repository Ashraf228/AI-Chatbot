"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { encodeSiteId } from "../../lib/site-id";
import { resolveWidgetLoaderUrl } from "../../lib/widget-loader-url";
import { Button } from "../shared/Button";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import { mapStatusSeverityToTone, type CustomerApiStatus } from "./customer-status";

type CustomerStatusBarProps = {
  siteId: string;
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
    return `/sites/${siteSlug}/knowledge`;
  }

  if (firstMissing === "behavior") {
    return `/sites/${siteSlug}/widget`;
  }

  if (firstMissing === "design") {
    return `/sites/${siteSlug}/branding`;
  }

  if (firstMissing === "embed") {
    return `/sites/${siteSlug}/embedding`;
  }

  if (firstMissing === "test") {
    return `/sites/${siteSlug}#customer-test-chat`;
  }

  return `/sites/${siteSlug}/setup`;
}

function primaryAction(siteId: string, status: CustomerApiStatus | null, site: SiteDetails | null) {
  const siteSlug = encodeSiteId(siteId);
  const isLive = Boolean(site?.goLiveAt || status?.lifecycleStatus === "live");

  if (isLive) {
    return { label: "Chat testen", href: `/sites/${siteSlug}#customer-test-chat` };
  }

  if ((status?.knowledgeCount ?? 0) === 0 || status?.missingSteps?.includes("knowledge")) {
    return { label: "Wissen hinzufügen", href: `/sites/${siteSlug}/knowledge` };
  }

  return { label: "Setup fortsetzen", href: localNextHref(siteId, status) };
}

export function CustomerStatusBar({ siteId }: CustomerStatusBarProps) {
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [status, setStatus] = useState<CustomerApiStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loaderUrl, setLoaderUrl] = useState(
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js",
  );

  useEffect(() => {
    setLoaderUrl(resolveWidgetLoaderUrl(process.env.NEXT_PUBLIC_WIDGET_LOADER_URL));
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
        <p>Kunde</p>
        <h2>{site?.name || siteId}</h2>
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
        <span>Nächster Schritt</span>
        <strong>{isLive ? "Betrieb prüfen" : status?.nextAction?.label || mainAction.label}</strong>
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

      {liveBlockedReason ? <p className="customer-status-bar__hint">Noch nicht bereit für Go-Live: {liveBlockedReason}</p> : null}
      {copied ? <p className="dashboard-status dashboard-status--success">Einbindungscode kopiert.</p> : null}
      {error ? <p className="dashboard-status dashboard-status--error">{error}</p> : null}
    </section>
  );
}
