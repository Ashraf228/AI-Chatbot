"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "../../shared/Button";

const MAX_KNOWLEDGE_SNIPPETS = 5;
const MAX_SNIPPET_EXCERPT_LENGTH = 320;
const MAX_PDF_UPLOAD_BYTES = 5 * 1024 * 1024;
const PDF_EXTRACT_ROUTE_SUFFIX = "conversation-engine/knowledge/pdf-extract";

const PDF_UPLOAD_ERROR_MESSAGES = {
  invalidType: "Nur .pdf-Dateien mit synthetischen/freigegebenen Demo-Inhalten sind in diesem Schritt erlaubt.",
  tooLarge: "PDF-Dateien duerfen maximal 5 MB gross sein.",
  extractFailed: "PDF konnte nicht sicher extrahiert werden.",
};

type BuilderFormState = {
  assistantName: string;
  companyContext: string;
  assistantRole: string;
  targetAudience: string;
  tone: "professional" | "friendly" | "consultative" | "formal";
  allowedTasks: string;
  blockedTasks: string;
  requiredFields: string;
  knowledgeSnippetTitle: string;
  knowledgeSnippetDraft: string;
  testMessage: string;
  handoffAllowed: boolean;
  ticketAllowed: boolean;
};

type DemoKnowledgeSnippet = {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  sourceType: string;
  scope: string;
  fileName?: string;
};

type PdfExtractResponse = {
  fileName: string;
  extractedText: string;
  extractedChars: number;
  originalChars: number;
  truncated: boolean;
};

type RuntimeKnowledgeRetrieval = {
  enabled: boolean;
  attempted: boolean;
  status: string;
  snippets: DemoKnowledgeSnippet[];
  warnings?: string[];
  reasons?: string[];
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
  knowledgeRetrieval?: RuntimeKnowledgeRetrieval;
  warnings?: string[];
  reasons?: string[];
};

type TranscriptHistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

type DemoWorkspaceChatTurn = {
  id: string;
  userMessage: string;
  assistantDraft: string;
  result: RuntimePilotResponse;
  submittedKnowledgeSnippets: DemoKnowledgeSnippet[];
  usedKnowledgeSnippets: DemoKnowledgeSnippet[];
};

type PersistedDemoWorkspaceConfig = {
  version: number;
  assistantName: string;
  companyContext: string;
  assistantRole: string;
  targetAudience: string[];
  tone: BuilderFormState["tone"];
  allowedTasks: string[];
  blockedTasks: string[];
  handoffAllowed: boolean;
  ticketAllowed: boolean;
  requiredFields: string[];
  metadata: {
    source: string;
    updatedAt: string;
    updatedByRole: "admin" | "operator";
    customerDataAllowed: false;
    knowledgePersistenceEnabled: false;
    chatHistoryPersistenceEnabled: false;
    publicWidgetActivation: false;
    productionActivation: false;
  };
};

type DemoWorkspaceConfigReadResponse = {
  hasSavedConfig: boolean;
  savedConfig: PersistedDemoWorkspaceConfig | null;
};

type DemoWorkspaceConfigWriteResponse = {
  saved?: boolean;
  deleted?: boolean;
  hadSavedConfig?: boolean;
  hasSavedConfig: boolean;
  savedConfig: PersistedDemoWorkspaceConfig | null;
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
  knowledgeSnippetTitle: "",
  knowledgeSnippetDraft: "",
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

function compactJson(value: RuntimePilotResponse) {
  return JSON.stringify(value, null, 2);
}

function sanitizeSnippetText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function buildDefaultSnippetTitle(index: number) {
  return `Demo Snippet ${index}`;
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim();
}

function sanitizeDisplayFileName(fileName: string) {
  return fileName
    .replace(/[\\/\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function parseSnippetBlocks(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((entry) => sanitizeSnippetText(entry))
    .filter((entry) => entry.length > 0);
}

function buildKnowledgeSnippet(params: {
  id: string;
  title: string;
  text: string;
  fileName?: string;
  sourceType?: string;
}): DemoKnowledgeSnippet | null {
  const excerpt = sanitizeSnippetText(params.text).slice(0, MAX_SNIPPET_EXCERPT_LENGTH);
  if (!excerpt) {
    return null;
  }

  return {
    id: params.id,
    title: params.title.trim().slice(0, 120) || "Demo Snippet",
    excerpt,
    score: 0.75,
    sourceType: params.sourceType || "synthetic",
    scope: "demo-workspace",
    fileName: params.fileName,
  };
}

function buildRuntimePilotPayload(
  form: BuilderFormState,
  message: string,
  history: TranscriptHistoryEntry[],
  knowledgeSnippets: DemoKnowledgeSnippet[],
) {
  return {
    message,
    history,
    knowledgeSnippets,
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
      testChatMode: "demo_workspace_in_memory_testchat_mvp",
      noPersistence: true,
      adminOnly: true,
      chatHistoryPersistence: false,
    },
  };
}

function buildTranscriptHistory(turns: DemoWorkspaceChatTurn[]): TranscriptHistoryEntry[] {
  return turns.flatMap((turn) => {
    const entries: TranscriptHistoryEntry[] = [{ role: "user", content: turn.userMessage }];
    if (turn.assistantDraft.trim()) {
      entries.push({ role: "assistant", content: turn.assistantDraft });
    }
    return entries;
  });
}

function buildSnippetListSummary(snippets: DemoKnowledgeSnippet[]) {
  if (snippets.length === 0) {
    return "keine";
  }

  return snippets.map((snippet) => snippet.title).join(", ");
}

function buildDemoWorkspaceConfigPayload(form: BuilderFormState) {
  return {
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
  };
}

function applyPersistedDemoWorkspaceConfig(
  savedConfig: PersistedDemoWorkspaceConfig,
  currentForm: BuilderFormState,
): BuilderFormState {
  return {
    ...currentForm,
    assistantName: savedConfig.assistantName,
    companyContext: savedConfig.companyContext,
    assistantRole: savedConfig.assistantRole,
    targetAudience: savedConfig.targetAudience.join("\n"),
    tone: savedConfig.tone,
    allowedTasks: savedConfig.allowedTasks.join("\n"),
    blockedTasks: savedConfig.blockedTasks.join("\n"),
    handoffAllowed: savedConfig.handoffAllowed,
    ticketAllowed: savedConfig.ticketAllowed,
    requiredFields: savedConfig.requiredFields.join("\n"),
  };
}

type DemoWorkspaceAgentBuilderCardProps = {
  siteId: string;
};

export function DemoWorkspaceAgentBuilderCard({ siteId }: DemoWorkspaceAgentBuilderCardProps) {
  const [form, setForm] = useState<BuilderFormState>(DEFAULT_FORM);
  const [knowledgeSnippets, setKnowledgeSnippets] = useState<DemoKnowledgeSnippet[]>([]);
  const [result, setResult] = useState<RuntimePilotResponse | null>(null);
  const [chatTurns, setChatTurns] = useState<DemoWorkspaceChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfUploadLoading, setPdfUploadLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState<"save" | "load" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configStatus, setConfigStatus] = useState<string | null>(null);
  const [savedConfigMeta, setSavedConfigMeta] = useState<PersistedDemoWorkspaceConfig["metadata"] | null>(null);

  function updateField<Key extends keyof BuilderFormState>(key: Key, value: BuilderFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function appendKnowledgeSnippets(nextSnippets: DemoKnowledgeSnippet[]) {
    setKnowledgeSnippets((current) => {
      const remainingSlots = Math.max(0, MAX_KNOWLEDGE_SNIPPETS - current.length);
      const accepted = nextSnippets.slice(0, remainingSlots);
      if (accepted.length < nextSnippets.length) {
        setKnowledgeError(`Maximal ${MAX_KNOWLEDGE_SNIPPETS} In-Memory-Snippets gleichzeitig erlaubt.`);
      } else {
        setKnowledgeError(null);
      }
      return [...current, ...accepted];
    });
  }

  function handleAddSnippetDraft() {
    const draft = form.knowledgeSnippetDraft.trim();
    if (!draft) {
      return;
    }

    const blocks = parseSnippetBlocks(draft);
    if (blocks.length === 0) {
      setKnowledgeError("Nur nicht-leere synthetische Demo-Inhalte koennen als Snippet hinzugefuegt werden.");
      return;
    }

    const baseIndex = knowledgeSnippets.length + 1;
    const nextSnippets = blocks
      .map((block, index) =>
        buildKnowledgeSnippet({
          id: `demo-snippet-${baseIndex + index}`,
          title:
            form.knowledgeSnippetTitle.trim().length > 0
              ? blocks.length === 1
                ? form.knowledgeSnippetTitle.trim()
                : `${form.knowledgeSnippetTitle.trim()} ${index + 1}`
              : buildDefaultSnippetTitle(baseIndex + index),
          text: block,
        }),
      )
      .filter((entry): entry is DemoKnowledgeSnippet => Boolean(entry));

    appendKnowledgeSnippets(nextSnippets);
    setForm((current) => ({
      ...current,
      knowledgeSnippetTitle: "",
      knowledgeSnippetDraft: "",
    }));
  }

  async function handleKnowledgeFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const baseIndex = knowledgeSnippets.length + 1;
    const supportedFiles = files.filter((file) => /\.(txt|md|markdown|json)$/i.test(file.name));
    if (supportedFiles.length !== files.length) {
      setKnowledgeError("Nur .txt, .md, .markdown oder .json als Plain-Text sind in diesem Schritt erlaubt.");
    } else {
      setKnowledgeError(null);
    }

    const uploadedSnippets: DemoKnowledgeSnippet[] = [];
    for (const [index, file] of supportedFiles.entries()) {
      const text = sanitizeSnippetText(await file.text());
      const snippet = buildKnowledgeSnippet({
        id: `demo-snippet-${baseIndex + index}`,
        title: stripFileExtension(file.name) || buildDefaultSnippetTitle(baseIndex + index),
        text,
        fileName: file.name,
      });
      if (snippet) {
        uploadedSnippets.push(snippet);
      }
    }

    appendKnowledgeSnippets(uploadedSnippets);
    event.target.value = "";
  }

  async function handlePdfKnowledgeUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const remainingSlots = Math.max(0, MAX_KNOWLEDGE_SNIPPETS - knowledgeSnippets.length);
    if (remainingSlots === 0) {
      setKnowledgeError(`Maximal ${MAX_KNOWLEDGE_SNIPPETS} In-Memory-Snippets gleichzeitig erlaubt.`);
      event.target.value = "";
      return;
    }

    if (files.some((file) => !/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf"))) {
      setKnowledgeError(PDF_UPLOAD_ERROR_MESSAGES.invalidType);
      event.target.value = "";
      return;
    }

    if (files.some((file) => file.size > MAX_PDF_UPLOAD_BYTES)) {
      setKnowledgeError(PDF_UPLOAD_ERROR_MESSAGES.tooLarge);
      event.target.value = "";
      return;
    }

    setPdfUploadLoading(true);
    setKnowledgeError(null);

    try {
      const uploadedSnippets: DemoKnowledgeSnippet[] = [];
      const errors: string[] = [];
      const baseIndex = knowledgeSnippets.length + 1;

      for (const [index, file] of files.slice(0, remainingSlots).entries()) {
        const formData = new FormData();
        formData.append("file", file, file.name);

        const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/${PDF_EXTRACT_ROUTE_SUFFIX}`, {
          method: "POST",
          body: formData,
        });
        const data = (await response.json().catch(() => ({}))) as Partial<PdfExtractResponse> & { message?: string };
        if (!response.ok) {
          errors.push(data.message || `${sanitizeDisplayFileName(file.name) || "PDF"} konnte nicht sicher extrahiert werden.`);
          continue;
        }

        const safeFileName = sanitizeDisplayFileName(
          typeof data.fileName === "string" && data.fileName.trim().length > 0 ? data.fileName : file.name,
        );
        const snippet = buildKnowledgeSnippet({
          id: `demo-snippet-${baseIndex + index}`,
          title: stripFileExtension(safeFileName) || buildDefaultSnippetTitle(baseIndex + index),
          text: typeof data.extractedText === "string" ? data.extractedText : "",
          fileName: safeFileName,
          sourceType: "pdf_demo",
        });

        if (!snippet) {
          errors.push(`"${safeFileName || file.name}" enthaelt keinen nutzbaren Textauszug.`);
          continue;
        }

        uploadedSnippets.push(snippet);
      }

      if (files.length > remainingSlots) {
        errors.push(`Maximal ${MAX_KNOWLEDGE_SNIPPETS} In-Memory-Snippets gleichzeitig erlaubt.`);
      }

      if (uploadedSnippets.length > 0) {
        appendKnowledgeSnippets(uploadedSnippets);
      }

      if (uploadedSnippets.length === 0 && errors.length === 0) {
        setKnowledgeError(PDF_UPLOAD_ERROR_MESSAGES.extractFailed);
      } else if (errors.length > 0) {
        setKnowledgeError(errors[0]);
      }
    } catch (uploadError) {
      setKnowledgeError(
        uploadError instanceof Error ? uploadError.message : PDF_UPLOAD_ERROR_MESSAGES.extractFailed,
      );
    } finally {
      setPdfUploadLoading(false);
      event.target.value = "";
    }
  }

  function removeKnowledgeSnippet(snippetId: string) {
    setKnowledgeSnippets((current) => current.filter((snippet) => snippet.id !== snippetId));
    setKnowledgeError(null);
  }

  function clearKnowledgeSnippets() {
    setKnowledgeSnippets([]);
    setKnowledgeError(null);
  }

  async function loadSavedDemoConfig() {
    setConfigLoading("load");
    setConfigError(null);
    setConfigStatus(null);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = (await response.json().catch(() => ({}))) as DemoWorkspaceConfigReadResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Gespeicherte Demo-Konfiguration konnte nicht geladen werden.");
      }
      const savedConfig = data.savedConfig;
      if (!data.hasSavedConfig || !savedConfig) {
        setSavedConfigMeta(null);
        setConfigStatus("Noch keine gespeicherte Demo-Konfiguration vorhanden.");
        return;
      }
      setForm((current) => applyPersistedDemoWorkspaceConfig(savedConfig, current));
      setSavedConfigMeta(savedConfig.metadata);
      setConfigStatus("Gespeicherte Demo-Konfiguration geladen. Knowledge, PDFs und Chat bleiben unverändert.");
    } catch (configLoadError) {
      setConfigError(
        configLoadError instanceof Error
          ? configLoadError.message
          : "Gespeicherte Demo-Konfiguration konnte nicht geladen werden.",
      );
    } finally {
      setConfigLoading(null);
    }
  }

  async function saveDemoConfig() {
    setConfigLoading("save");
    setConfigError(null);
    setConfigStatus(null);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildDemoWorkspaceConfigPayload(form)),
        },
      );
      const data = (await response.json().catch(() => ({}))) as DemoWorkspaceConfigWriteResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Demo-Konfiguration konnte nicht gespeichert werden.");
      }
      setSavedConfigMeta(data.savedConfig?.metadata || null);
      setConfigStatus("Demo-Konfiguration gespeichert. Es wurden nur Agent-Felder gespeichert.");
    } catch (configSaveError) {
      setConfigError(
        configSaveError instanceof Error
          ? configSaveError.message
          : "Demo-Konfiguration konnte nicht gespeichert werden.",
      );
    } finally {
      setConfigLoading(null);
    }
  }

  async function resetSavedDemoConfig() {
    setConfigLoading("reset");
    setConfigError(null);
    setConfigStatus(null);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/config`,
        {
          method: "DELETE",
        },
      );
      const data = (await response.json().catch(() => ({}))) as DemoWorkspaceConfigWriteResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Gespeicherte Demo-Konfiguration konnte nicht zurückgesetzt werden.");
      }
      setForm((current) => ({
        ...current,
        ...DEFAULT_FORM,
        knowledgeSnippetTitle: current.knowledgeSnippetTitle,
        knowledgeSnippetDraft: current.knowledgeSnippetDraft,
        testMessage: current.testMessage,
      }));
      setSavedConfigMeta(null);
      setConfigStatus(
        data.hadSavedConfig
          ? "Gespeicherte Demo-Konfiguration gelöscht. Knowledge, PDFs und Chat wurden nicht gespeichert."
          : "Es war keine gespeicherte Demo-Konfiguration vorhanden.",
      );
    } catch (configResetError) {
      setConfigError(
        configResetError instanceof Error
          ? configResetError.message
          : "Gespeicherte Demo-Konfiguration konnte nicht zurückgesetzt werden.",
      );
    } finally {
      setConfigLoading(null);
    }
  }

  async function runBuilder() {
    const message = form.testMessage.trim();
    if (!message) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const history = buildTranscriptHistory(chatTurns);
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/runtime-pilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRuntimePilotPayload(form, message, history, knowledgeSnippets)),
      });
      const data = (await response.json().catch(() => ({}))) as RuntimePilotResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Demo-Workspace-Agent konnte nicht simuliert werden.");
      }

      const assistantDraft = data.engineResponsePreview?.draft?.text || "";
      const usedKnowledgeSnippets = data.knowledgeRetrieval?.snippets || [];
      setResult(data);
      setChatTurns((current) => [
        ...current,
        {
          id: `demo-chat-turn-${current.length + 1}`,
          userMessage: message,
          assistantDraft,
          result: data,
          submittedKnowledgeSnippets: knowledgeSnippets.map((snippet) => ({ ...snippet })),
          usedKnowledgeSnippets,
        },
      ]);
      setForm((current) => ({ ...current, testMessage: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo-Workspace-Agent konnte nicht simuliert werden.");
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setChatTurns([]);
    setResult(null);
    setError(null);
  }

  const draftText = result?.engineResponsePreview?.draft?.text || "Noch keine Simulation ausgefuehrt.";
  const resultKnowledgeSnippets = result?.knowledgeRetrieval?.snippets || [];

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
          <li>Nur synthetische/freigegebene Demo-Inhalte</li>
          <li>Keine Kundendaten</li>
          <li>Keine Production-Daten</li>
          <li>Knowledge wird nicht gespeichert</li>
          <li>Dateien werden nicht dauerhaft gespeichert</li>
          <li>Keine Embeddings / kein RAG-Indexing</li>
          <li>Kein Deploy</li>
          <li>Keine Public-Widget-Aktivierung</li>
          <li>PDF-Text wird nur in-memory extrahiert</li>
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

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        <div>
          <strong>Demo Workspace Config Persistence (MVP)</strong>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Gespeichert wird nur die Agent-Konfiguration fuer diesen Admin-/Operator-Demo-Workspace. Knowledge,
            PDFs und Chat bleiben in-memory und werden nicht gespeichert. Kein Deploy, keine Public-Widget-Aktivierung.
          </p>
        </div>
        <ul className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          <li>Only config is saved</li>
          <li>Knowledge, PDFs und Chat werden nicht gespeichert</li>
          <li>Kein Deploy / keine Public-Widget-Aktivierung</li>
        </ul>
        <div className="dashboard-grid dashboard-grid--metrics-3">
          <Button
            type="button"
            variant="secondary"
            onClick={saveDemoConfig}
            disabled={configLoading !== null}
          >
            {configLoading === "save" ? "Speichert..." : "Save demo config"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={loadSavedDemoConfig}
            disabled={configLoading !== null}
          >
            {configLoading === "load" ? "Laedt..." : "Load saved config"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={resetSavedDemoConfig}
            disabled={configLoading !== null}
          >
            {configLoading === "reset" ? "Setzt zurueck..." : "Reset saved config"}
          </Button>
        </div>
        {savedConfigMeta ? (
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Letzte gespeicherte Demo-Konfiguration: {savedConfigMeta.updatedAt} · Rolle: {savedConfigMeta.updatedByRole}
          </p>
        ) : null}
        {configStatus ? <div className="dashboard-status dashboard-status--info">{configStatus}</div> : null}
        {configError ? <div className="dashboard-status dashboard-status--error">{configError}</div> : null}
      </div>

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        <div>
          <strong>In-Memory Knowledge Upload (MVP)</strong>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Text-, Markdown- und PDF-Snippets bleiben ausschliesslich im Browser-State und werden pro Testchat-Turn an
            den bestehenden Runtime-Pilot weitergegeben. PDF-Text wird serverseitig nur fuer diesen Request
            extrahiert, nicht gespeichert und nicht indexiert.
          </p>
        </div>

        <ul className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          <li>Unterstuetzt: Paste, .txt, .md, .markdown, .json als Plain-Text</li>
          <li>Unterstuetzt: .pdf bis 5 MB per sicherer In-Memory-Extraktion</li>
          <li>Maximal {MAX_KNOWLEDGE_SNIPPETS} aktive Snippets gleichzeitig</li>
        </ul>

        <div className="dashboard-grid dashboard-grid--metrics-3">
          <label className="dashboard-field">
            <span className="dashboard-field-label">Snippet Title (optional)</span>
            <input
              className="dashboard-input"
              value={form.knowledgeSnippetTitle}
              onChange={(event) => updateField("knowledgeSnippetTitle", event.target.value)}
              placeholder="z. B. Demo FAQ"
            />
          </label>
        </div>

        <label className="dashboard-field">
          <span className="dashboard-field-label">Knowledge Snippet Text</span>
          <textarea
            className="dashboard-textarea wizard-textarea-compact"
            rows={5}
            value={form.knowledgeSnippetDraft}
            onChange={(event) => updateField("knowledgeSnippetDraft", event.target.value)}
            placeholder="Nur synthetische/freigegebene Demo-Inhalte. Mehrere Snippets koennen per Leerzeile getrennt eingefuegt werden."
          />
        </label>

        <div className="dashboard-grid dashboard-grid--metrics-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddSnippetDraft}
            disabled={!form.knowledgeSnippetDraft.trim()}
          >
            Snippet aus Text hinzufuegen
          </Button>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Text/Markdown-Datei laden</span>
            <input
              className="dashboard-input"
              type="file"
              accept=".txt,.md,.markdown,.json,text/plain,text/markdown,application/json"
              multiple
              onChange={handleKnowledgeFileUpload}
            />
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Demo-PDF laden</span>
            <input
              className="dashboard-input"
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={pdfUploadLoading}
              onChange={handlePdfKnowledgeUpload}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={clearKnowledgeSnippets}
            disabled={pdfUploadLoading || knowledgeSnippets.length === 0}
          >
            Alle Snippets entfernen
          </Button>
        </div>

        {pdfUploadLoading ? (
          <div className="dashboard-status dashboard-status--info">PDF-Text wird sicher in-memory extrahiert...</div>
        ) : null}
        {knowledgeError ? <div className="dashboard-status dashboard-status--error">{knowledgeError}</div> : null}

        <div className="dashboard-stack dashboard-stack--sm">
          <strong>Aktive Knowledge Snippets ({knowledgeSnippets.length})</strong>
          {knowledgeSnippets.length === 0 ? (
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Noch keine In-Memory-Snippets aktiv. TXT/Markdown/PDF bleibt lokal oder request-lokal und wird nicht gespeichert.
            </p>
          ) : (
            <div className="dashboard-stack dashboard-stack--sm">
              {knowledgeSnippets.map((snippet) => (
                <div key={snippet.id} className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
                  <div className="dashboard-grid dashboard-grid--metrics-3">
                    <div>
                      <strong>{snippet.title}</strong>
                      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                        {snippet.fileName ? `Datei: ${snippet.fileName}` : "Quelle: Paste / In-Memory"}
                      </p>
                    </div>
                    <div>
                      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                        sourceType={snippet.sourceType} · scope={snippet.scope}
                      </p>
                    </div>
                    <div>
                      <Button type="button" variant="ghost" onClick={() => removeKnowledgeSnippet(snippet.id)}>
                        Snippet entfernen
                      </Button>
                    </div>
                  </div>
                  <p className="dashboard-copy dashboard-no-margin-bottom">{snippet.excerpt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        <strong>Demo Workspace Testchat (MVP)</strong>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Mehrstufiger Admin-/Operator-Testchat nur im Browser-State. Der Chatverlauf wird nicht gespeichert und jede
          Testnachricht nutzt weiter ausschliesslich den bestehenden Runtime-Pilot-Endpunkt.
        </p>
        <ul className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          <li>Nur Admin-/Operator-Testpfad</li>
          <li>Nur synthetische/freigegebene Demo-Inhalte</li>
          <li>Chatverlauf wird nicht gespeichert</li>
          <li>Keine Kundendaten</li>
          <li>Keine Production-Daten</li>
          <li>Kein Deploy</li>
          <li>Keine Public-Widget-Aktivierung</li>
          <li>PDF-Text wird nur in-memory extrahiert</li>
          <li>Keine echten Tickets, E-Mails oder Webhooks</li>
        </ul>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-3">
        <Button type="button" variant="secondary" onClick={runBuilder} disabled={loading || !form.testMessage.trim()}>
          {loading ? "Testchat simuliert..." : "Testnachricht senden"}
        </Button>
        <Button type="button" variant="ghost" onClick={clearChat} disabled={loading || chatTurns.length === 0}>
          In-Memory-Chat leeren
        </Button>
      </div>

      {error ? <div className="dashboard-status dashboard-status--error">{error}</div> : null}

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        <strong>Chat-Transcript</strong>
        {chatTurns.length === 0 ? (
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Noch keine Testnachricht gesendet. Der Transcript lebt nur im Browser-State.
          </p>
        ) : (
          <div className="dashboard-stack dashboard-stack--sm">
            {chatTurns.map((turn, index) => (
              <div key={turn.id} className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
                <div>
                  <strong>Turn {index + 1}: User</strong>
                  <p className="dashboard-copy dashboard-no-margin-bottom">{turn.userMessage}</p>
                </div>
                <div>
                  <strong>Response Draft</strong>
                  <p className="dashboard-copy dashboard-no-margin-bottom">
                    {turn.assistantDraft || "Kein Draft zurueckgegeben."}
                  </p>
                </div>
                <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                  Knowledge Submitted: {buildSnippetListSummary(turn.submittedKnowledgeSnippets)}
                </p>
                <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                  Knowledge Used: {buildSnippetListSummary(turn.usedKnowledgeSnippets)}
                </p>
                <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                  intent={turn.result.conversationEnginePreview?.intent || "unknown"} · goal=
                  {turn.result.conversationEnginePreview?.goal || "unknown"} · stage=
                  {turn.result.conversationEnginePreview?.stage || "unknown"} · agent=
                  {turn.result.runtimeState?.selectedAgentKey || turn.result.conversationEnginePreview?.selectedAgentKey || "kein Agent"} ·
                  nextAction={turn.result.runtimeState?.nextActionKey || turn.result.conversationEnginePreview?.nextAction || "keine"}
                </p>
                <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                  Missing Fields: {turn.result.conversationEnginePreview?.missingFields?.length ? turn.result.conversationEnginePreview.missingFields.join(", ") : "keine"}
                </p>
                <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                  Activation Boundary: publicWidgetActivation=
                  {String(turn.result.activationBoundary?.publicWidgetActivation ?? false)} · productionActivation=
                  {String(turn.result.activationBoundary?.productionActivation ?? false)} · deployRequired=
                  {String(turn.result.activationBoundary?.deployRequired ?? false)}
                </p>
                <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                  Side Effects: planned={String(turn.result.sideEffects?.planned ?? false)} · ticket=
                  {String(turn.result.sideEffects?.ticketDelivery ?? false)} · email=
                  {String(turn.result.sideEffects?.emailDelivery ?? false)} · webhook=
                  {String(turn.result.sideEffects?.webhookDelivery ?? false)} · provider=
                  {String(turn.result.sideEffects?.providerCalls ?? false)} · db=
                  {String(turn.result.sideEffects?.dbAccessForNewLogic ?? false)} · sql=
                  {String(turn.result.sideEffects?.sql ?? false)} · queryRunner=
                  {String(turn.result.sideEffects?.queryRunner ?? false)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

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
            <strong>Knowledge Usage</strong>
            <p className="dashboard-copy dashboard-no-margin-bottom">
              Active Snippets: {knowledgeSnippets.length} · Used By Runtime Pilot: {result.runtimeState?.sourcesUsed ?? 0}
            </p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Used Snippet Titles: {buildSnippetListSummary(resultKnowledgeSnippets)}
            </p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Retrieval Status: {result.knowledgeRetrieval?.status || "unknown"}
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
              Der Runtime-Pilot bleibt ein reiner Admin-Testpfad ohne Persistenz, ohne Deploy, ohne Public-Widget-
              Aktivierung.
            </p>
          </div>

          <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
            <strong>Side Effects Boundary</strong>
            <p className="dashboard-copy dashboard-no-margin-bottom">
              planned={String(result.sideEffects?.planned ?? false)} · ticket=
              {String(result.sideEffects?.ticketDelivery ?? false)} · email=
              {String(result.sideEffects?.emailDelivery ?? false)} · webhook=
              {String(result.sideEffects?.webhookDelivery ?? false)} · provider=
              {String(result.sideEffects?.providerCalls ?? false)} · db=
              {String(result.sideEffects?.dbAccessForNewLogic ?? false)} · sql=
              {String(result.sideEffects?.sql ?? false)} · queryRunner=
              {String(result.sideEffects?.queryRunner ?? false)}
            </p>
          </div>

          <details className="dashboard-card dashboard-card--soft">
            <summary className="dashboard-copy">Runtime-Pilot Raw JSON</summary>
            <pre className="dashboard-pre">{compactJson(result)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
