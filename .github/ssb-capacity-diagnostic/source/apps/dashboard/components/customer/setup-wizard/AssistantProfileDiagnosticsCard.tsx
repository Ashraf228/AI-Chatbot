"use client";

import { useEffect, useState } from "react";
import { EmptyStateCard } from "../../shared/EmptyStateCard";

type RequiredField = {
  key: string;
  label: string;
  required: boolean;
  source?: string;
};

type DeliveryChannel = {
  type: string;
  enabled: boolean;
  status: string;
};

type AssistantProfileDebug = {
  profileKey: string;
  profileVersion: number;
  assistantName: string;
  role: string;
  tone: string;
  answerStyle: string;
  knowledgeMode: string;
  legacySource: string;
  sourceLabel: string;
  enabledTasks: string[];
  enabledAgents: string[];
  requiredFields: RequiredField[];
  handoffRules: {
    enabled: boolean;
    requireAllFields: boolean;
    summarizeBeforeHandoff: boolean;
    handoffWhenUncertain: boolean;
  };
  deliveryChannels: DeliveryChannel[];
  warnings: string[];
  migrationHints: string[];
};

type MigrationChange = {
  type: "mapped" | "created" | "unchanged" | "deprecated";
  from?: string;
  to?: string;
  description: string;
};

type MigrationPreview = {
  currentProfile: AssistantProfileDebug;
  proposedAssistantProfile: {
    profileKey: string;
    profileVersion: number;
    assistantName: string;
    enabledTasks: string[];
    enabledAgents: string[];
    requiredFields: RequiredField[];
  };
  proposedConversationEngineConfig: Record<string, unknown>;
  proposedStorageLocation: string;
  changes: MigrationChange[];
  warnings: string[];
  blockers: string[];
  reversible: boolean;
};

type DiagnosticsResponse = {
  assistantProfileDebug?: AssistantProfileDebug;
};

type AssistantProfileDiagnosticsCardProps = {
  siteId: string;
};

const TASK_LABELS: Record<string, string> = {
  answer_questions: "Fragen beantworten",
  collect_context: "Kontext sammeln",
  cite_sources: "Quellen nutzen",
  triage_support: "Supportfall eingrenzen",
  prepare_handoff: "Übergabe vorbereiten",
  qualify_lead: "Anfrage qualifizieren",
  capture_contact: "Kontaktdaten erfassen",
  local_service_intake: "Erstkontakt führen",
  capture_lead: "Anfrage speichern",
};

function labelForTask(value: string) {
  return TASK_LABELS[value] || value;
}

function compactTechnicalJson(profile: AssistantProfileDebug) {
  return JSON.stringify(
    {
      profileKey: profile.profileKey,
      profileVersion: profile.profileVersion,
      legacySource: profile.legacySource,
      requiredFields: profile.requiredFields,
      handoffRules: profile.handoffRules,
      deliveryChannels: profile.deliveryChannels,
    },
    null,
    2,
  );
}

function compactPreviewJson(preview: MigrationPreview) {
  return JSON.stringify(
    {
      proposedAssistantProfile: preview.proposedAssistantProfile,
      proposedConversationEngineConfig: preview.proposedConversationEngineConfig,
      proposedStorageLocation: preview.proposedStorageLocation,
      changes: preview.changes,
      warnings: preview.warnings,
      blockers: preview.blockers,
      reversible: preview.reversible,
    },
    null,
    2,
  );
}

export function AssistantProfileDiagnosticsCard({ siteId }: AssistantProfileDiagnosticsCardProps) {
  const [profile, setProfile] = useState<AssistantProfileDebug | null>(null);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/assistant-profile/diagnostics`, {
          cache: "no-store",
        });
        if (response.status === 403) {
          if (!cancelled) {
            setProfile(null);
            setError(null);
          }
          return;
        }

        const data = (await response.json().catch(() => ({}))) as DiagnosticsResponse;
        if (!response.ok) {
          throw new Error("KI-Mitarbeiter-Profil konnte nicht geladen werden.");
        }

        if (!cancelled) {
          setProfile(data.assistantProfileDebug || null);
        }

        const previewResponse = await fetch(
          `/api/sites/${encodeURIComponent(siteId)}/assistant-profile/migration-preview`,
          { cache: "no-store" },
        );
        if (previewResponse.ok) {
          const previewData = (await previewResponse.json().catch(() => null)) as MigrationPreview | null;
          if (!cancelled) {
            setPreview(previewData);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "KI-Mitarbeiter-Profil konnte nicht geladen werden.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  if (loading) {
    return (
      <div className="setup-module-card dashboard-stack dashboard-stack--sm">
        <h3 className="dashboard-card-title dashboard-card-title--sm">KI-Mitarbeiter Profil</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">Profil-Diagnose wird geladen.</p>
      </div>
    );
  }

  if (!profile) {
    if (!error) {
      return null;
    }

    return <EmptyStateCard title="KI-Mitarbeiter Profil" description={error} />;
  }

  const enabledDelivery = profile.deliveryChannels.filter((channel) => channel.enabled).map((channel) => channel.type);

  async function saveAssistantProfile() {
    if (!preview || preview.blockers.length > 0) {
      return;
    }

    setSavingProfile(true);
    setSaveStatus(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/assistant-profile/migrate`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        saved?: boolean;
        assistantProfileDebug?: AssistantProfileDebug;
        message?: string;
      };
      if (!response.ok || !data.saved) {
        throw new Error(data.message || "Profil konnte nicht gespeichert werden.");
      }
      if (data.assistantProfileDebug) {
        setProfile(data.assistantProfileDebug);
      }
      setSaveStatus({
        tone: "success",
        message: "Neutrales Profil gespeichert. Bestehende Einstellungen bleiben erhalten.",
      });
    } catch (err) {
      setSaveStatus({
        tone: "error",
        message: err instanceof Error ? err.message : "Profil konnte nicht gespeichert werden.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="setup-module-card dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">KI-Mitarbeiter Profil</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Diagnose der aktuell aufgelösten Assistant-Konfiguration. Diese Anzeige beeinflusst den Chat noch nicht.
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-3">
        <div className="dashboard-card dashboard-card--compact">
          <strong>Aktives Profil</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">{profile.assistantName}</p>
        </div>
        <div className="dashboard-card dashboard-card--compact">
          <strong>Quelle</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">{profile.sourceLabel}</p>
        </div>
        <div className="dashboard-card dashboard-card--compact">
          <strong>Übergabe</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">
            {profile.handoffRules.enabled ? "aktiv" : "inaktiv"}
          </p>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--split">
        <InfoList title="Aufgaben" items={profile.enabledTasks.map(labelForTask)} emptyText="Keine Aufgaben aktiviert" />
        <InfoList title="Agenten" items={profile.enabledAgents} emptyText="Keine Agenten aktiviert" />
      </div>

      <div>
        <strong>Pflichtinformationen</strong>
        {profile.requiredFields.length > 0 ? (
          <div className="dashboard-inline dashboard-wrap dashboard-mt-8">
            {profile.requiredFields.map((field) => (
              <span key={field.key} className="dashboard-pill">
                {field.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">Keine Pflichtinformationen definiert.</p>
        )}
      </div>

      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
        Zustellung: {enabledDelivery.length > 0 ? enabledDelivery.join(", ") : "nicht aktiv oder nicht konfiguriert"}
      </p>

      {profile.warnings.length > 0 ? (
        <div className="dashboard-status dashboard-status--warning">
          Hinweise: {profile.warnings.join(" · ")}
        </div>
      ) : null}

      <details className="dashboard-card dashboard-card--soft">
        <summary className="dashboard-accordion__summary">Erweitert: technische Diagnose</summary>
        <div className="dashboard-stack dashboard-stack--sm dashboard-mt-14">
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Profil {profile.profileKey}@v{profile.profileVersion}, technische Quelle: {profile.legacySource}
          </p>
          <pre className="dashboard-code-block">{compactTechnicalJson(profile)}</pre>
          {profile.migrationHints.length > 0 ? (
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Migration: {profile.migrationHints.join(" · ")}
            </p>
          ) : null}
        </div>
      </details>

      {preview ? (
        <MigrationPreviewPanel
          preview={preview}
          saving={savingProfile}
          saveStatus={saveStatus}
          onSave={saveAssistantProfile}
        />
      ) : null}
    </div>
  );
}

function MigrationPreviewPanel({
  preview,
  saving,
  saveStatus,
  onSave,
}: {
  preview: MigrationPreview;
  saving: boolean;
  saveStatus: { tone: "success" | "error"; message: string } | null;
  onSave: () => void;
}) {
  const mappedChanges = preview.changes.filter((change) => change.type === "mapped");
  const hasBlockers = preview.blockers.length > 0;

  return (
    <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
      <div>
        <h4 className="dashboard-card-title dashboard-card-title--sm">Migration-Vorschau</h4>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Nur Vorschau – noch nicht gespeichert. Es wird keine automatische Migration ausgeführt.
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-3">
        <div className="dashboard-card dashboard-card--compact">
          <strong>Aktuell</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">{preview.currentProfile.assistantName}</p>
        </div>
        <div className="dashboard-card dashboard-card--compact">
          <strong>Zielprofil</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">
            {preview.proposedAssistantProfile.assistantName}
          </p>
        </div>
        <div className="dashboard-card dashboard-card--compact">
          <strong>Status</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">
            {preview.blockers.length > 0 ? "Blocker vorhanden" : "Dry-Run möglich"}
          </p>
        </div>
      </div>

      <InfoList
        title="Was übernommen würde"
        items={mappedChanges.map((change) => change.description)}
        emptyText="Keine Legacy-Übernahmen erkannt"
      />

      {preview.warnings.length > 0 ? (
        <div className="dashboard-status dashboard-status--warning">
          Warnungen: {preview.warnings.join(" · ")}
        </div>
      ) : null}

      {preview.blockers.length > 0 ? (
        <div className="dashboard-status dashboard-status--error">
          Blocker: {preview.blockers.join(" · ")}
        </div>
      ) : null}

      <button
        type="button"
        className="dashboard-button dashboard-button--secondary"
        disabled={hasBlockers || saving}
        title={hasBlockers ? "Blocker zuerst prüfen" : "Bestehende Einstellungen bleiben erhalten"}
        onClick={onSave}
      >
        {saving ? "Profil wird gespeichert..." : "KI-Mitarbeiter-Profil speichern"}
      </button>

      {hasBlockers ? (
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Speichern ist erst möglich, wenn die Blocker geklärt sind.
        </p>
      ) : null}

      {saveStatus ? (
        <div className={`dashboard-status dashboard-status--${saveStatus.tone}`}>
          {saveStatus.message} Die bestehende Chat-Logik bleibt unverändert, bis die neue Conversation Engine aktiviert wird.
        </div>
      ) : null}

      <details className="dashboard-card dashboard-card--soft">
        <summary className="dashboard-accordion__summary">Erweitert: technische Migration-Vorschau</summary>
        <div className="dashboard-stack dashboard-stack--sm dashboard-mt-14">
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Speicherort: {preview.proposedStorageLocation}
          </p>
          <pre className="dashboard-code-block">{compactPreviewJson(preview)}</pre>
        </div>
      </details>
    </div>
  );
}

function InfoList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div>
      <strong>{title}</strong>
      {items.length > 0 ? (
        <ul className="dashboard-list dashboard-no-margin-bottom">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">{emptyText}</p>
      )}
    </div>
  );
}
