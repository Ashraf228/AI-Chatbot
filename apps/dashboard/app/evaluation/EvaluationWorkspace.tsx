"use client";

import { useEffect, useRef, useState } from "react";

type EvaluationContext = {
  workspaceTitle: string;
  siteDisplayName: string;
  disclaimer: string;
  accountExpiresAt: string | null;
  scenarios: Array<{ key: string; title: string; prompt: string; demo: boolean }>;
  technicalFeatures: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; sourceType: string; publicUrl?: string; demo: true }>;
  handoffPreview?: { status: string; summary: string; demo: true } | null;
  ticketPreview?: TicketPreview | null;
};

type TicketPreview = {
  status: "collecting" | "ready" | "urgent_escalation";
  fields: Record<string, string | undefined>;
  missingFields: string[];
  previewToken?: string;
  expiresAt?: string;
  demo: true;
  synthetic: true;
};

type HandoffStatus = {
  status: string;
  demoReference?: string;
  attemptCount?: number;
  signatureVerified?: boolean;
  duplicateRecognized?: boolean;
  receivedAt?: string | null;
  httpStatus?: number | null;
  retryable?: boolean;
  errorCode?: string | null;
  message?: string;
  externalNotice?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Kein Ablaufdatum hinterlegt";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Kein Ablaufdatum hinterlegt"
    : date.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

function safeText(value: string) {
  return value.replace(/\[(DATEN BEREINIGT|REDACTED)]/gi, "[Inhalt entfernt]");
}

export function EvaluationWorkspace({ context }: { context: EvaluationContext }) {
  const [conversationId, setConversationId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [ticketActionLoading, setTicketActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryMessage, setRetryMessage] = useState("");
  const [ticketResult, setTicketResult] = useState("");
  const [ticketCreated, setTicketCreated] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState<HandoffStatus | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const ticketResultRef = useRef<HTMLDivElement | null>(null);
  const ticketPreviewRef = useRef<HTMLDivElement | null>(null);
  const lastAnnouncedAssistantRef = useRef("");

  const userQuestionCount = messages.filter((entry) => entry.role === "user").length;
  const sourcedAnswers = messages.filter((entry) => entry.role === "assistant" && (entry.sources || []).length > 0).length;
  const knowledgeGaps = messages.filter((entry) => /keine passende information|keine verifizierten/i.test(entry.content)).length;
  const handoffs = messages.filter((entry) => entry.handoffPreview).length;

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const response = await fetch("/api/evaluation/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error("Der Evaluationsdialog konnte nicht gestartet werden.");
    }
    const data = await response.json();
    setConversationId(data.conversationId);
    return data.conversationId as string;
  }

  async function sendMessage(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();
    if (!message || loading) return;
    setLoading(true);
    setError("");
    setRetryMessage("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    if (!messageOverride) {
      setInput("");
    }

    try {
      const id = await ensureConversation();
      const response = await fetch("/api/evaluation/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, message }),
      });
      if (response.status === 401 || response.status === 403) {
        setConversationId("");
        setMessages([]);
        setRetryMessage("");
        setError("Ihre Evaluationssitzung ist nicht mehr gueltig. Bitte melden Sie sich erneut an.");
        return;
      }
      if (!response.ok) {
        throw new Error("Die Nachricht konnte nicht verarbeitet werden.");
      }
      const data = await response.json();
      const assistantContent = safeText(data.answer || "");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: assistantContent,
          sources: Array.isArray(data.sources) ? data.sources : [],
          handoffPreview: data.handoffPreview || null,
          ticketPreview: data.ticketPreview || null,
        },
      ]);
      if (assistantContent && assistantContent !== lastAnnouncedAssistantRef.current) {
        lastAnnouncedAssistantRef.current = assistantContent;
        setStatusAnnouncement(`Antwort des Assistenten: ${assistantContent}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
      setRetryMessage(message);
      setStatusAnnouncement("Fehler beim Verarbeiten der Nachricht.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmTicket(preview: TicketPreview) {
    if (!conversationId || !preview.previewToken || ticketActionLoading) return;
    setTicketActionLoading(true);
    setError("");
    try {
      const response = await fetch("/api/evaluation/chat/ticket/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, previewToken: preview.previewToken }),
      });
      if (!response.ok) {
        throw new Error("Der Demo-Supportfall konnte nicht erstellt werden.");
      }
      const data = await response.json();
      setTicketResult(data.note || "Der Demo-Supportfall wurde im Demonstrator erfasst. Es erfolgte keine Übermittlung an ein externes Ticketsystem.");
      setStatusAnnouncement(`Ticketstatus: ${data.note || "Der Demo-Supportfall wurde im Demonstrator erfasst. Es erfolgte keine externe Übermittlung."}`);
      setTicketCreated(true);
      setHandoffStatus({ status: "not_requested", message: "Noch keine Demo-Übergabe ausgeführt." });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.note || "Der Demo-Supportfall wurde im Demonstrator erfasst. Es erfolgte keine Übermittlung an ein externes Ticketsystem.",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setTicketActionLoading(false);
    }
  }

  async function runSignedHandoff() {
    if (!conversationId || handoffLoading) return;
    setHandoffLoading(true);
    setError("");
    setHandoffStatus({ status: "mock_delivering", message: "Signierte Demo-Übergabe wird geprüft." });
    try {
      const response = await fetch("/api/evaluation/chat/ticket/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Die signierte Demo-Übergabe konnte nicht ausgeführt werden.");
      }
      setHandoffStatus(data);
      setStatusAnnouncement(`Handoffstatus: ${data.message || "Die signierte Demo-Übergabe wurde abgeschlossen."}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setHandoffLoading(false);
    }
  }

  async function cancelTicket(preview: TicketPreview) {
    if (!conversationId || !preview.previewToken || ticketActionLoading) return;
    setTicketActionLoading(true);
    setError("");
    try {
      await fetch("/api/evaluation/chat/ticket/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, previewToken: preview.previewToken }),
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Die Demo-Ticketvorschau wurde verworfen." },
      ]);
    } finally {
      setTicketActionLoading(false);
    }
  }

  useEffect(() => {
    if (ticketResult) {
      ticketResultRef.current?.focus();
    }
  }, [ticketResult]);

  useEffect(() => {
    const latestTicketPreview = [...messages].reverse().find((message) => message.ticketPreview)?.ticketPreview;
    if (latestTicketPreview) {
      ticketPreviewRef.current?.focus();
    }
  }, [messages]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {statusAnnouncement}
        </div>
        <header className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-300">Evaluation Workspace</p>
              <h1 className="mt-3 text-3xl font-semibold">{context.workspaceTitle}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">{context.disclaimer}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
                Logout
              </button>
            </form>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-100">Kooperationsdemonstrator</span>
            <span className="rounded-full bg-sky-400/20 px-3 py-1 text-sky-100">Nur-Lesezugang</span>
            <span className="rounded-full bg-slate-700 px-3 py-1">
              Ablauf: <time dateTime={context.accountExpiresAt || undefined}>{formatDate(context.accountExpiresAt)}</time>
            </span>
          </div>
          <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
            Bitte geben Sie keine Passwörter, MFA-Codes, API-Schlüssel oder echten personenbezogenen Falldaten ein.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {context.scenarios.map((scenario) => (
            <button
              key={scenario.key}
              type="button"
              onClick={() => {
                setInput(scenario.prompt);
                setStatusAnnouncement(`Beispieltext übernommen: ${scenario.title}. Er wurde noch nicht gesendet.`);
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-left transition hover:bg-white/10"
              aria-describedby={`scenario-${scenario.key}-prompt`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Synthetisches Szenario</p>
              <h2 className="mt-2 text-lg font-semibold">{scenario.title}</h2>
              <p id={`scenario-${scenario.key}-prompt`} className="mt-3 text-sm text-slate-300">{scenario.prompt}</p>
            </button>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white p-4 text-slate-950">
            <div className="min-h-[360px] space-y-4 rounded-2xl bg-slate-50 p-4" aria-busy={loading}>
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500">Noch keine Daten. Starten Sie einen neuen Testdialog.</p>
              ) : (
                messages.map((message, index) => (
                  <article key={index} className={message.role === "user" ? "text-right" : "text-left"}>
                    <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-slate-950 text-white" : "bg-white shadow"}`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {(message.sources || []).length > 0 && (
                        <div className="mt-3 border-t pt-2 text-xs text-slate-600">
                          <p className="font-semibold">Quellen</p>
                          {message.sources?.map((source, sourceIndex) => (
                            <p key={sourceIndex}>
                              {source.publicUrl ? (
                                <a href={source.publicUrl} target="_blank" rel="noreferrer noopener" className="underline">
                                  {source.title}
                                </a>
                              ) : (
                                source.title
                              )}{" "}
                              ({source.sourceType})
                            </p>
                          ))}
                        </div>
                      )}
                      {message.handoffPreview && (
                        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                          <strong>{message.handoffPreview.status}:</strong> {message.handoffPreview.summary}
                        </div>
                      )}
                      {message.ticketPreview && (
                        <div
                          ref={ticketPreviewRef}
                          tabIndex={-1}
                          className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-left text-xs text-sky-950"
                          aria-labelledby={`ticket-preview-${index}`}
                        >
                          <p id={`ticket-preview-${index}`} className="font-semibold">Demo-Supportfall Vorschau</p>
                          {message.ticketPreview.missingFields.length > 0 ? (
                            <p className="mt-2 text-amber-800">
                              Fehlende Angaben: {message.ticketPreview.missingFields.join(", ")}
                            </p>
                          ) : (
                            <dl className="mt-2 space-y-1">
                              {Object.entries(message.ticketPreview.fields)
                                .filter(([key, value]) => key !== "reporterEmail" && Boolean(value))
                                .map(([key, value]) => (
                                  <div key={key}>
                                    <dt className="font-semibold">{key}</dt>
                                    <dd className="whitespace-pre-wrap">{safeText(String(value))}</dd>
                                  </div>
                                ))}
                            </dl>
                          )}
                          {message.ticketPreview.previewToken && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => confirmTicket(message.ticketPreview as TicketPreview)}
                                disabled={ticketActionLoading}
                                className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                Demo-Ticket erstellen
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelTicket(message.ticketPreview as TicketPreview)}
                                disabled={ticketActionLoading}
                                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                              >
                                Abbrechen
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
            {ticketResult && (
              <div ref={ticketResultRef} tabIndex={-1} className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                {ticketResult}
              </div>
            )}
            {ticketCreated && (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Signierte Demo-Übergabe</p>
                    <p className="mt-1">{handoffStatus?.message || "Noch keine Demo-Übergabe ausgeführt."}</p>
                    {handoffStatus?.externalNotice && <p className="mt-1">{handoffStatus.externalNotice}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={runSignedHandoff}
                    disabled={handoffLoading}
                    className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {handoffLoading ? "Prüft..." : "Signierte Demo-Übergabe simulieren"}
                  </button>
                </div>
                {handoffStatus && handoffStatus.status !== "not_requested" && (
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div><dt className="font-semibold">Demo-Referenz</dt><dd>{handoffStatus.demoReference || "Nicht verfügbar"}</dd></div>
                    <div><dt className="font-semibold">Status</dt><dd>{handoffStatus.status}</dd></div>
                    <div><dt className="font-semibold">Versuche</dt><dd>{handoffStatus.attemptCount ?? 0}</dd></div>
                    <div><dt className="font-semibold">Signatur geprüft</dt><dd>{handoffStatus.signatureVerified ? "Ja" : "Nein"}</dd></div>
                    <div><dt className="font-semibold">Duplikat sicher erkannt</dt><dd>{handoffStatus.duplicateRecognized ? "Ja" : "Nein"}</dd></div>
                    <div><dt className="font-semibold">Empfangen</dt><dd>{formatDate(handoffStatus.receivedAt)}</dd></div>
                  </dl>
                )}
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
                <p>{error}</p>
                {retryMessage && (
                  <button
                    type="button"
                    onClick={() => sendMessage(retryMessage)}
                    className="mt-2 rounded-full bg-red-700 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Erneut versuchen
                  </button>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <label className="sr-only" htmlFor="evaluation-message">
                Testfrage
              </label>
              <textarea
                id="evaluation-message"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={2000}
                className="min-h-20 flex-1 rounded-2xl border border-slate-200 p-3 text-sm"
                placeholder="Testfrage eingeben..."
                aria-describedby="evaluation-message-help"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Sendet..." : "Senden"}
              </button>
            </div>
            <p id="evaluation-message-help" className="mt-2 text-xs text-slate-600">
              Enter im Textfeld erzeugt Text. Nutzen Sie die Schaltfläche „Senden“, um die Testfrage zu übermitteln.
            </p>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <h2 className="font-semibold">Werte dieser Testsitzung</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-400">Fragen</dt><dd className="text-xl font-semibold">{userQuestionCount || "Noch keine Daten"}</dd></div>
                <div><dt className="text-slate-400">Mit Quellen</dt><dd className="text-xl font-semibold">{sourcedAnswers || "Noch keine Daten"}</dd></div>
                <div><dt className="text-slate-400">Wissensluecken</dt><dd className="text-xl font-semibold">{knowledgeGaps || "Noch keine Daten"}</dd></div>
                <div><dt className="text-slate-400">Uebergaben</dt><dd className="text-xl font-semibold">{handoffs || "Noch keine Daten"}</dd></div>
              </dl>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <h2 className="font-semibold">Technische Uebersicht</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {context.technicalFeatures.map((feature) => <li key={feature}>- {feature}</li>)}
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
