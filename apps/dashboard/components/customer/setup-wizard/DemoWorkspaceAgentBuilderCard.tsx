"use client";

import { useState } from "react";
import { Button } from "../../shared/Button";

type BuilderFormState = {
  assistantName: string;
  companyContext: string;
  assistantRole: string;
  targetAudience: string;
  tone: "professional" | "friendly" | "consultative" | "formal";
  allowedTasks: string;
  blockedTasks: string;
  requiredFields: string;
  syntheticKnowledgeSnippets: string;
  testMessage: string;
  handoffAllowed: boolean;
  ticketAllowed: boolean;
};

type RuntimePilotResponse = {
  runtimePilotEnabled?: boolean;
  activationBoundary?: {
    mode: string;
    publicWidgetActivation: boolean;
    productionActivation: boolean;
    deployRequired: boolean;
  };
  sideEffects?: {
    planned: boolean;
    ticketDelivery: boolean;
    emailDelivery: boolean;
    webhookDelivery: boolean;
    providerCalls: boolean;
    dbAccessForNewLogic: boolean;
    sql: boolean;
    queryRunner: boolean;
  };
  runtimeState?: {
    selectedAgentKey: string | null;
    nextActionKey: string | null;
    shouldHandoff: boolean;
    shouldAskQuestion: boolean;
    handoffOfferSimulated: boolean;
    ticketFieldRequestSimulated: boolean;
    sourcesUsed: number;
    sourceRequired: boolean;
  };
  conversationEnginePreview?: {
    intent: string;
    goal: string;
    stage: string;
    selectedAgentKey: string | null;
    nextAction: string;
    shouldHandoff: boolean;
    missingFields: string[];
  } | null;
  engineResponsePreview?: {
    draft: null | {
      text: string;
      nextActionLabel: string;
    };
    safety: {
      noSideEffects: true;
      publicWidgetUnaffected: true;
      integrationsSuppressed: true;
      sanitized: true;
    };
  } | null;
  warnings?: string[];
  reasons?: string[];
};

const DEFAULT_FORM: BuilderFormState = {
  assistantName: "Demo Workspace Agent",
  companyContext: "",
  assistantRole: "Digitaler Demo-Assistent fuer Admin-Tests",
  targetAudience: "",
  tone: "professional",
  allowedTasks: "answer_questions\ncollect_requests\ntriage_support\nprepare_handoff",
  blockedTasks: "",
  requiredFields: "fullName\nemail\ndescription",
  syntheticKnowledgeSnippets: "",
  testMessage: "",
  handoffAllowed: true,
  ticketAllowed: false,
};

function splitLines(value: string, limit = 16) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, limit);
}

function buildKnowledgeSnippets(value: string) {
  return splitLines(value, 5).map((excerpt, index) => ({
    id: `demo-snippet-${index + 1}`,
    title: `Demo Snippet ${index + 1}`,
    excerpt,
    score: 0.75,
    sourceType: "synthetic",
    scope: "demo-workspace",
  }));
}

function compactJson(value: RuntimePilotResponse) {
  return JSON.stringify(value, null, 2);
}

type DemoWorkspaceAgentBuilderCardProps = {
  siteId: string;
};

export function DemoWorkspaceAgentBuilderCard({ siteId }: DemoWorkspaceAgentBuilderCardProps) {
  const [form, setForm] = useState<BuilderFormState>(DEFAULT_FORM);
  const [result, setResult] = useState<RuntimePilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<Key extends keyof BuilderFormState>(key: Key, value: BuilderFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function runBuilder() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/runtime-pilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: form.testMessage,
          knowledgeSnippets: buildKnowledgeSnippets(form.syntheticKnowledgeSnippets),
          demoWorkspace: {
            assistantName: form.assistantName,
            companyContext: form.companyContext,
            assistantRole: form.assistantRole,
            targetAudience: splitLines(form.targetAudience, 8),
            tone: form.tone,
            allowedTasks: splitLines(form.allowedTasks, 16),
            blockedTasks: splitLines(form.blockedTasks, 16),
            handoffAllowed: form.handoffAllowed,
            ticketAllowed: form.ticketAllowed,
            requiredFields: splitLines(form.requiredFields, 8),
          },
          existingConversationState: {
            builderMode: "demo_workspace_agent_builder_mvp",
            noPersistence: true,
            adminOnly: true,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as RuntimePilotResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Demo-Workspace-Agent konnte nicht simuliert werden.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo-Workspace-Agent konnte nicht simuliert werden.");
    } finally {
      setLoading(false);
    }
  }

  const draftText = result?.engineResponsePreview?.draft?.text || "Noch keine Simulation ausgefuehrt.";

  return (
    <div className="setup-module-card dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Demo Workspace Agent Builder (MVP)</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Admin-/Operator-only Testpfad fuer einen synthetischen Runtime-Pilot. Keine Persistenz, keine Public-Widget-
          Aktivierung, keine DB-Schreibvorgaenge, keine Provider-Calls und keine realen Tickets, E-Mails oder Webhooks.
        </p>
      </div>

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        <strong>Sicherheitsgrenzen</strong>
        <ul className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          <li>Nur Admin-/Operator-Testpfad</li>
          <li>Nur synthetische/in-memory Konfiguration</li>
          <li>Keine Kundendaten</li>
          <li>Keine Production-Daten</li>
          <li>Nicht gespeichert</li>
          <li>Kein Deploy</li>
          <li>Keine Public-Widget-Aktivierung</li>
          <li>Kein PDF-Upload</li>
          <li>Kein Knowledge-Upload</li>
          <li>Keine echten Tickets, E-Mails oder Webhooks</li>
        </ul>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-3">
        <label className="dashboard-field">
          <span className="dashboard-field-label">Assistant Name</span>
          <input
            className="dashboard-input"
            value={form.assistantName}
            onChange={(event) => updateField("assistantName", event.target.value)}
          />
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Assistant Role</span>
          <input
            className="dashboard-input"
            value={form.assistantRole}
            onChange={(event) => updateField("assistantRole", event.target.value)}
          />
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Tone</span>
          <select
            className="dashboard-select"
            value={form.tone}
            onChange={(event) => updateField("tone", event.target.value as BuilderFormState["tone"])}
          >
            <option value="professional">professional</option>
            <option value="friendly">friendly</option>
            <option value="consultative">consultative</option>
            <option value="formal">formal</option>
          </select>
        </label>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-field-label">Company Context</span>
        <textarea
          className="dashboard-textarea wizard-textarea-compact"
          rows={3}
          value={form.companyContext}
          onChange={(event) => updateField("companyContext", event.target.value)}
          placeholder="Kurzbeschreibung, Einsatzgebiet, Grenzen des Demo-Agenten"
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-field-label">Target Audience (eine Zeile oder CSV)</span>
        <textarea
          className="dashboard-textarea wizard-textarea-compact"
          rows={2}
          value={form.targetAudience}
          onChange={(event) => updateField("targetAudience", event.target.value)}
          placeholder="Ops-Team&#10;Support-Leads"
        />
      </label>

      <div className="dashboard-grid dashboard-grid--metrics-3">
        <label className="dashboard-field">
          <span className="dashboard-field-label">Allowed Tasks</span>
          <textarea
            className="dashboard-textarea wizard-textarea-compact"
            rows={4}
            value={form.allowedTasks}
            onChange={(event) => updateField("allowedTasks", event.target.value)}
          />
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Blocked Tasks</span>
          <textarea
            className="dashboard-textarea wizard-textarea-compact"
            rows={4}
            value={form.blockedTasks}
            onChange={(event) => updateField("blockedTasks", event.target.value)}
            placeholder="create_ticket&#10;deploy"
          />
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Required Fields</span>
          <textarea
            className="dashboard-textarea wizard-textarea-compact"
            rows={4}
            value={form.requiredFields}
            onChange={(event) => updateField("requiredFields", event.target.value)}
          />
        </label>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-field-label">Synthetic Knowledge Snippets</span>
        <textarea
          className="dashboard-textarea wizard-textarea-compact"
          rows={4}
          value={form.syntheticKnowledgeSnippets}
          onChange={(event) => updateField("syntheticKnowledgeSnippets", event.target.value)}
          placeholder="Eine Zeile pro Snippet. Rein synthetisch, keine echten Kundendaten."
        />
      </label>

      <label className="dashboard-field">
        <span className="dashboard-field-label">Test Message</span>
        <textarea
          className="dashboard-textarea wizard-textarea-compact"
          rows={3}
          value={form.testMessage}
          onChange={(event) => updateField("testMessage", event.target.value)}
          placeholder="Beschreibe hier die Demo-Nachricht fuer den Runtime-Pilot."
        />
      </label>

      <label className="dashboard-toggle-row">
        <input
          type="checkbox"
          checked={form.handoffAllowed}
          onChange={(event) => updateField("handoffAllowed", event.target.checked)}
        />
        <span>Handoff im Demo-Kontext erlaubt</span>
      </label>

      <label className="dashboard-toggle-row">
        <input
          type="checkbox"
          checked={form.ticketAllowed}
          onChange={(event) => updateField("ticketAllowed", event.target.checked)}
        />
        <span>Ticket-Vorbereitung im Demo-Kontext erlauben</span>
      </label>

      <Button type="button" variant="secondary" onClick={runBuilder} disabled={loading || !form.testMessage.trim()}>
        {loading ? "Builder simuliert..." : "Demo-Agent simulieren"}
      </Button>

      {error ? <div className="dashboard-status dashboard-status--error">{error}</div> : null}

      {result ? (
        <div className="dashboard-stack dashboard-stack--sm">
          <div className="dashboard-grid dashboard-grid--metrics-3">
            <div className="dashboard-card dashboard-card--compact">
              <strong>Intent</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                {result.conversationEnginePreview?.intent || "unknown"}
              </p>
            </div>
            <div className="dashboard-card dashboard-card--compact">
              <strong>Goal</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                {result.conversationEnginePreview?.goal || "unknown"}
              </p>
            </div>
            <div className="dashboard-card dashboard-card--compact">
              <strong>Stage</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                {result.conversationEnginePreview?.stage || "unknown"}
              </p>
            </div>
          </div>

          <div className="dashboard-grid dashboard-grid--metrics-3">
            <div className="dashboard-card dashboard-card--compact">
              <strong>Selected Agent</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                {result.runtimeState?.selectedAgentKey || result.conversationEnginePreview?.selectedAgentKey || "kein Agent"}
              </p>
            </div>
            <div className="dashboard-card dashboard-card--compact">
              <strong>Next Action</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                {result.runtimeState?.nextActionKey || result.conversationEnginePreview?.nextAction || "keine"}
              </p>
            </div>
            <div className="dashboard-card dashboard-card--compact">
              <strong>Should Handoff</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                {result.runtimeState?.shouldHandoff || result.conversationEnginePreview?.shouldHandoff ? "ja" : "nein"}
              </p>
            </div>
          </div>

          <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
            <strong>Response Draft</strong>
            <p className="dashboard-copy dashboard-no-margin-bottom">{draftText}</p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Missing Fields: {result.conversationEnginePreview?.missingFields?.length ? result.conversationEnginePreview.missingFields.join(", ") : "keine"}
            </p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Next Action Label: {result.engineResponsePreview?.draft?.nextActionLabel || result.conversationEnginePreview?.nextAction || "keine"}
            </p>
          </div>

          <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
            <strong>Activation Boundary</strong>
            <p className="dashboard-copy dashboard-no-margin-bottom">
              mode={result.activationBoundary?.mode || "unknown"} · publicWidgetActivation=
              {String(result.activationBoundary?.publicWidgetActivation ?? false)} · productionActivation=
              {String(result.activationBoundary?.productionActivation ?? false)} · deployRequired=
              {String(result.activationBoundary?.deployRequired ?? false)}
            </p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              sideEffects planned={String(result.sideEffects?.planned ?? false)} · ticket=
              {String(result.sideEffects?.ticketDelivery ?? false)} · email=
              {String(result.sideEffects?.emailDelivery ?? false)} · webhook=
              {String(result.sideEffects?.webhookDelivery ?? false)} · provider=
              {String(result.sideEffects?.providerCalls ?? false)} · db=
              {String(result.sideEffects?.dbAccessForNewLogic ?? false)} · sql=
              {String(result.sideEffects?.sql ?? false)} · queryRunner=
              {String(result.sideEffects?.queryRunner ?? false)}
            </p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Runtime-Pilot bleibt ohne Persistenz, ohne Deploy, ohne Public-Widget-Aktivierung, ohne PDF-Upload und ohne Knowledge-Upload.
            </p>
          </div>

          {result.warnings?.length ? (
            <div className="dashboard-status dashboard-status--warning">
              Hinweise: {result.warnings.join(" · ")}
            </div>
          ) : null}

          <details className="dashboard-card dashboard-card--soft">
            <summary className="dashboard-accordion__summary">Technische Runtime-Pilot-Antwort</summary>
            <pre className="dashboard-code-block dashboard-mt-14">{compactJson(result)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
