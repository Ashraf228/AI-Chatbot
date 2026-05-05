"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { encodeSiteId } from "../../lib/site-id";
import { resolveWidgetLoaderUrl } from "../../lib/widget-loader-url";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";

type CustomerQuickActionsProps = {
  siteId: string;
};

type SiteDetails = {
  name: string;
  siteKey: string;
  allowedDomains: string[];
  lastTestedAt: string;
  goLiveAt: string;
};

function formatDate(value: string) {
  if (!value) {
    return "Noch nicht gesetzt";
  }

  return new Date(value).toLocaleString("de-DE");
}

export function CustomerQuickActions({ siteId }: CustomerQuickActionsProps) {
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [loaderUrl, setLoaderUrl] = useState(
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js",
  );

  useEffect(() => {
    setLoaderUrl(resolveWidgetLoaderUrl(process.env.NEXT_PUBLIC_WIDGET_LOADER_URL));
  }, []);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.message || "Quick Actions konnten nicht geladen werden.");
        return;
      }

      setSite({
        name: data.name || "",
        siteKey: data.siteKey || "",
        allowedDomains: Array.isArray(data.allowedDomains) ? data.allowedDomains : [],
        lastTestedAt: data.lastTestedAt || "",
        goLiveAt: data.goLiveAt || "",
      });
    }

    load();
  }, [siteId]);

  const embedCode = useMemo(() => {
    if (!site?.siteKey) {
      return "";
    }

    return `<script src="${loaderUrl}" data-site-key="${site.siteKey}" defer></script>`;
  }, [loaderUrl, site?.siteKey]);

  async function copyEmbedCode() {
    if (!embedCode) {
      setError("Es ist noch kein Einbindungscode vorhanden.");
      return;
    }

    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied("Einbindungscode");
      setError(null);
      setMessage(null);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Einbindungscode konnte nicht kopiert werden.");
    }
  }

  async function markLive() {
    setSaving("live");
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/widget/config/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goLiveAt: new Date().toISOString(),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Live-Status konnte nicht gesetzt werden.");
      setSaving(null);
      return;
    }

    setSite((current) =>
      current
        ? {
            ...current,
            goLiveAt: data.goLiveAt ?? new Date().toISOString(),
          }
        : current,
    );
    setMessage("Kunde als live markiert.");
    setSaving(null);
  }

  const canMarkLive = Boolean(
    site?.siteKey && site.allowedDomains.length > 0 && site.lastTestedAt && !site.goLiveAt,
  );

  return (
    <div className="dashboard-stack">
      <section className="dashboard-card dashboard-stack">
        <div>
          <h2 className="dashboard-card-title">Quick Actions</h2>
          <p className="dashboard-copy">
            Die häufigsten Aufgaben für diesen Kunden sind hier direkt erreichbar.
          </p>
        </div>

        <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
          <Link href={`/sites/${siteSlug}/knowledge`} className="dashboard-button dashboard-button--secondary">
            Wissen hinzufügen
          </Link>
          <Link href={`/sites/${siteSlug}#setup-step-testing`} className="dashboard-button dashboard-button--secondary">
            Chat testen
          </Link>
          <Button type="button" variant="secondary" onClick={copyEmbedCode}>
            Widget-Code kopieren
          </Button>
          <Link href={`/sites/${siteSlug}/reports`} className="dashboard-button dashboard-button--secondary">
            Bericht ansehen
          </Link>
          <Button
            type="button"
            onClick={markLive}
            disabled={!canMarkLive || saving === "live"}
          >
            {site?.goLiveAt ? "Bereits live" : saving === "live" ? "Schaltet live..." : "Kunde live schalten"}
          </Button>
        </div>

        {site ? (
          <div className="dashboard-grid dashboard-grid--two">
            <div className="dashboard-card dashboard-card--soft">
              <strong>Letzter Test</strong>
              <p className="dashboard-copy dashboard-copy--muted">{formatDate(site.lastTestedAt)}</p>
            </div>
            <div className="dashboard-card dashboard-card--soft">
              <strong>Live-Status</strong>
              <p className="dashboard-copy dashboard-copy--muted">{formatDate(site.goLiveAt)}</p>
            </div>
          </div>
        ) : null}

        {copied ? <p className="dashboard-status dashboard-status--success">{copied} kopiert.</p> : null}
        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
        {error ? <ErrorState message={error} /> : null}
      </section>

      <section className="dashboard-card dashboard-stack">
        <div>
          <h2 className="dashboard-card-title">Test-Checkliste</h2>
          <p className="dashboard-copy">
            Nutze diese Reihenfolge, bevor du den Kunden live schaltest.
          </p>
        </div>

        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <div className="dashboard-info-row">
            <strong>1. Begrüßung und Design prüfen</strong>
            <Link href={`/sites/${siteSlug}/branding`} className="dashboard-link-card">
              Design öffnen
            </Link>
          </div>
          <div className="dashboard-info-row">
            <strong>2. Typische Fragen testen</strong>
            <Link href={`/sites/${siteSlug}/widget`} className="dashboard-link-card">
              Verhalten öffnen
            </Link>
          </div>
          <div className="dashboard-info-row">
            <strong>3. Wissensstand gegenprüfen</strong>
            <Link href={`/sites/${siteSlug}/knowledge`} className="dashboard-link-card">
              Wissen öffnen
            </Link>
          </div>
          <div className="dashboard-info-row">
            <strong>4. Einbindung und Domain prüfen</strong>
            <Link href={`/sites/${siteSlug}/embedding`} className="dashboard-link-card">
              Einbindung öffnen
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
