"use client";

import { useEffect, useState } from "react";

import { Button } from "../shared/Button";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";

type TemplateItem = {
  key: string;
  title: string;
  category: string;
  issueType: string;
  tags: string[];
  importedSourceId: string | null;
};

type TemplateCatalog = {
  siteId: string;
  templates: TemplateItem[];
  providerCallsUsed: false;
  answerReadyTransitionAdded: false;
};

export function CustomerItKnowledgeTemplatesPanel({
  siteId,
  onChanged,
}: {
  siteId: string;
  onChanged?: () => void;
}) {
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [mode, setMode] = useState<"skip_existing" | "overwrite">("skip_existing");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/it-knowledge/templates`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setForbidden(true);
        setCatalog(null);
        return;
      }
      if (!response.ok) {
        setError(data?.message || "IT-Wissensvorlagen konnten nicht geladen werden.");
        return;
      }
      setForbidden(false);
      setCatalog(data as TemplateCatalog);
    } catch {
      setError("IT-Wissensvorlagen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, [siteId]);

  function toggleTemplate(key: string) {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );
  }

  async function importTemplates() {
    if (selectedKeys.length === 0) {
      setError("Bitte mindestens eine IT-Wissensvorlage auswählen.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/it-knowledge/templates/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateKeys: selectedKeys, mode }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "IT-Wissensvorlagen konnten nicht übernommen werden.");
        return;
      }

      const imported = Array.isArray(data.imported) ? data.imported.length : 0;
      const overwritten = Array.isArray(data.overwritten) ? data.overwritten.length : 0;
      const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
      setMessage(
        `${imported + overwritten} Entwurf${imported + overwritten === 1 ? "" : "e"} gespeichert, ${skipped} unverändert.`,
      );
      setSelectedKeys([]);
      await loadCatalog();
      onChanged?.();
    } catch {
      setError("IT-Wissensvorlagen konnten nicht übernommen werden.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(sourceId: string) {
    if (!window.confirm("Diesen inaktiven Vorlagenentwurf wirklich entfernen?")) return;
    setDeletingSourceId(sourceId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/it-knowledge/templates/${encodeURIComponent(sourceId)}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "Der Vorlagenentwurf konnte nicht entfernt werden.");
        return;
      }
      setMessage("Vorlagenentwurf entfernt.");
      await loadCatalog();
      onChanged?.();
    } catch {
      setError("Der Vorlagenentwurf konnte nicht entfernt werden.");
    } finally {
      setDeletingSourceId(null);
    }
  }

  if (loading) {
    return (
      <section className="dashboard-card">
        <p className="dashboard-copy">Prüfe Wissensberechtigung...</p>
      </section>
    );
  }

  if (forbidden) {
    return (
      <section className="dashboard-card dashboard-stack">
        <div>
          <p className="dashboard-eyebrow">Lesemodus</p>
          <h2 className="dashboard-card-title">Wissensverwaltung nicht zugewiesen</h2>
          <p className="dashboard-copy">
            Dein Konto kann Wissen ansehen, besitzt für diese Site aber keine explizite
            Wissensverwaltungs-Capability. Diese Berechtigung kann nur intern vergeben werden.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-card dashboard-stack">
      <div>
        <p className="dashboard-eyebrow">IT-Support Poweruser</p>
        <h2 className="dashboard-card-title">Freigegebene Wissensvorlagen</h2>
        <p className="dashboard-copy">
          Übernimm sichere IT-Support-Vorlagen als inaktive Entwürfe. Dabei werden keine
          Embeddings erzeugt, keine Provider aufgerufen und keine Quelle einsatzbereit geschaltet.
        </p>
      </div>

      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      {!catalog || catalog.templates.length === 0 ? (
        <EmptyState title="Keine freigegebenen IT-Wissensvorlagen vorhanden." />
      ) : (
        <div className="dashboard-grid dashboard-grid--two" style={{ gap: 14 }}>
          {catalog.templates.map((template) => (
            <article key={template.key} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <label className="dashboard-inline" style={{ alignItems: "flex-start", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={selectedKeys.includes(template.key)}
                  onChange={() => toggleTemplate(template.key)}
                  aria-label={`${template.title} auswählen`}
                />
                <span>
                  <strong>{template.title}</strong>
                  <span className="dashboard-copy dashboard-copy--muted" style={{ display: "block", marginTop: 4 }}>
                    {template.category} · {template.tags.join(", ")}
                  </span>
                </span>
              </label>
              <div className="dashboard-inline" style={{ justifyContent: "space-between", gap: 10 }}>
                <span className={`dashboard-status ${template.importedSourceId ? "dashboard-status--success" : ""}`}>
                  {template.importedSourceId ? "Entwurf vorhanden" : "Noch nicht übernommen"}
                </span>
                {template.importedSourceId ? (
                  <Button
                    variant="danger"
                    onClick={() => deleteTemplate(template.importedSourceId as string)}
                    disabled={deletingSourceId === template.importedSourceId}
                  >
                    {deletingSourceId === template.importedSourceId ? "Entfernt..." : "Entwurf entfernen"}
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="dashboard-inline" style={{ alignItems: "flex-end", gap: 12 }}>
        <label className="dashboard-field" style={{ minWidth: 240 }}>
          <span className="dashboard-field-label">Wiederholungsmodus</span>
          <select
            className="dashboard-control"
            value={mode}
            onChange={(event) => setMode(event.target.value as "skip_existing" | "overwrite")}
          >
            <option value="skip_existing">Vorhandene Entwürfe behalten</option>
            <option value="overwrite">Ausgewählte Entwürfe aktualisieren</option>
          </select>
        </label>
        <Button onClick={importTemplates} disabled={saving || selectedKeys.length === 0}>
          {saving ? "Speichert..." : `${selectedKeys.length} Vorlage${selectedKeys.length === 1 ? "" : "n"} übernehmen`}
        </Button>
      </div>
    </section>
  );
}
