"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { resolveWidgetLoaderUrl } from "../../lib/widget-loader-url";
import { EmbedSnippetCard } from "./EmbedSnippetCard";

type SiteEmbeddingPanelProps = {
  siteId: string;
};

type SiteDetails = {
  id: string;
  name: string;
  siteKey: string;
  allowedDomains: string[];
  widgetBundleUrl?: string;
};

export function SiteEmbeddingPanel({ siteId }: SiteEmbeddingPanelProps) {
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loaderUrl, setLoaderUrl] = useState(
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoaderUrl(resolveWidgetLoaderUrl(process.env.NEXT_PUBLIC_WIDGET_LOADER_URL));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Einbindungsdaten konnten nicht geladen werden.");
        setLoading(false);
        return;
      }

      setSite({
        id: data.id,
        name: data.name,
        siteKey: data.siteKey,
        allowedDomains: Array.isArray(data.allowedDomains) ? data.allowedDomains : [],
        widgetBundleUrl: data.widgetBundleUrl || "",
      });
      setLoading(false);
    }

    load();
  }, [siteId]);

  const embedCode = useMemo(() => {
    if (!site) {
      return "";
    }

    return `<script src="${loaderUrl}" data-site-key="${site.siteKey}" defer></script>`;
  }, [loaderUrl, site]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setError(null);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(`${label} konnte nicht kopiert werden.`);
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!site) {
    return <ErrorState message="Keine Einbindungsdaten vorhanden." />;
  }

  return (
    <div className="dashboard-stack">
      <div className="dashboard-card dashboard-stack dashboard-stack--sm">
        <div>
          <h2 className="dashboard-card-title">Einbindung auf Kundenseiten</h2>
          <p className="dashboard-copy">
            Hier findest du den Einbindungscode für die Website, den Einbindungsschlüssel und die
            aktuell erlaubten Domains.
          </p>
        </div>

        <div className="dashboard-info-row">
          <strong>Kunde</strong>
          <span>{site.name}</span>
        </div>
        <div className="dashboard-info-row">
          <strong>Erlaubte Domains</strong>
          <span>{site.allowedDomains.join(", ") || "Noch keine Domain hinterlegt"}</span>
        </div>
      </div>

      <EmbedSnippetCard
        loaderUrl={loaderUrl}
        siteKey={site.siteKey}
        embedCode={embedCode}
        copied={copied}
        onCopy={copyText}
      />
    </div>
  );
}
