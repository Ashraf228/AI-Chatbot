"use client";

import { useEffect, useRef, useState } from "react";

type EvaluationContext = {
  workspaceTitle: string;
  workspaceSubtitle?: string;
  siteDisplayName: string;
  disclaimer: string;
  accountExpiresAt: string | null;
  scenarios: Array<{
    key: string;
    category?: string;
    persona?: string;
    title: string;
    prompt: string;
    goal?: string;
    observe?: string;
    demo: boolean;
  }>;
  benefits?: Array<{ title: string; text: string }>;
  demoAreas?: string[];
  proofPoints?: string[];
  expansionStages?: Array<{ title: string; items: string[] }>;
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

const ticketFieldLabels: Record<string, string> = {
  supportProfile: "Support-Art",
  product: "Produkt",
  module: "Bereich / Modul",
  customerOrganization: "Organisation",
  customerReference: "Kundennummer / Referenz",
  processOrFormName: "Prozess oder Formular",
  description: "Beschreibung",
  impact: "Auswirkung",
  browser: "Browser",
  device: "Gerät",
  operatingSystem: "Betriebssystem",
  errorMessage: "Fehlermeldung",
  alreadyTried: "Bereits versucht",
  reporterName: "Ansprechperson",
};

const ticketValueLabels: Record<string, Record<string, string>> = {
  supportProfile: {
    product: "Produktsupport",
    it: "IT-Support",
  },
  impact: {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    critical: "Kritisch",
  },
};

function ticketFieldLabel(key: string) {
  return ticketFieldLabels[key] || key;
}

function ticketFieldValue(key: string, value: string) {
  return ticketValueLabels[key]?.[value] || safeText(value);
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
  const benefits = context.benefits?.length ? context.benefits : [
    {
      title: "Für Kommunen",
      text: "Bürgerinnen, Bürger und Mitarbeitende erhalten schnellere Orientierung.",
    },
  ];
  const demoAreas = context.demoAreas?.length ? context.demoAreas : ["Bürgerservice", "Online-Anträge", "Support & Handoff"];
  const proofPoints = context.proofPoints?.length ? context.proofPoints : [
    "Quellenbasierte Antwortlogik",
    "Sichere Nicht-Antwort",
    "Keine externe Übermittlung",
  ];
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
        setStatusAnnouncement(`Antwort des KI-Mitarbeiters: ${assistantContent}`);
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
    <main className="evaluation-workspace">
      <div className="evaluation-shell">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {statusAnnouncement}
        </div>
        <header className="evaluation-hero">
          <div className="evaluation-hero__topline">
            <div>
              <p className="evaluation-eyebrow">Evaluationsbereich</p>
              <h1>{context.workspaceTitle}</h1>
              <p className="evaluation-hero__subtitle">
                {context.workspaceSubtitle ||
                  "Diese Demo zeigt, wie ein KI-Zusatzmodul kommunale Fragen und Supportfälle quellenbasiert unterstützen könnte."}
              </p>
              <p className="evaluation-hero__copy">{context.disclaimer}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="evaluation-secondary-button" type="submit">
                Logout
              </button>
            </form>
          </div>
          <div className="evaluation-badges">
            <span>Kooperationsdemonstrator</span>
            <span>Nur-Lesezugang</span>
            <span>Keine Konfiguration</span>
            <span>Keine Kundendaten</span>
            <span>Kein Public Widget</span>
            <span>Keine Production</span>
            <span>
              Ablauf: <time dateTime={context.accountExpiresAt || undefined}>{formatDate(context.accountExpiresAt)}</time>
            </span>
          </div>
          <p className="evaluation-warning">
            Bitte geben Sie keine Passwörter, MFA-Codes, API-Schlüssel oder echten personenbezogenen Falldaten ein.
          </p>
          <p className="evaluation-demo-note">
            Hinweis: Diese Ansicht ist ein Demonstrator. Ablauf, Inhalte, Fragen und Übergaben können für Kundenprojekte
            angepasst werden.
          </p>
          <p className="evaluation-demo-note">
            Externe Demo-Zugaenge bleiben gefuehrt und nur zum Lesen. Keine Einrichtung, kein Wissens-Upload, keine
            Produktivsysteme und keine echten NOLIS-Zugriffe.
          </p>
        </header>

        <section className="evaluation-benefits" aria-label="Nutzen der Demo">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="evaluation-benefit-card">
              <p>{benefit.title}</p>
              <h2>{benefit.text}</h2>
            </article>
          ))}
        </section>

        <section className="evaluation-overview-grid" aria-label="Demo-Übersicht">
          <article className="evaluation-card">
            <p className="evaluation-eyebrow">Was könnte NOLIS anbieten?</p>
            <h2>Kommunale KI-Assistenz als Zusatzmodul</h2>
            <p className="evaluation-card-copy">
              Der Demonstrator verbindet synthetische kommunale Wissensbereiche mit einem kontrollierten Testdialog,
              einer Ticketvorschau und einem signierten Mock-Handoff. Er behauptet keine Produktivintegration.
            </p>
            <div className="evaluation-area-chips">
              {demoAreas.map((area) => <span key={area}>{area}</span>)}
            </div>
          </article>
          <article className="evaluation-card">
            <p className="evaluation-eyebrow">Was diese Demo zeigt</p>
            <ul className="evaluation-proof-list">
              {proofPoints.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </article>
        </section>

        <section className="evaluation-section-intro" aria-labelledby="evaluation-scenarios-heading">
          <div>
            <p className="evaluation-eyebrow">Geführte Testszenarien</p>
            <h2 id="evaluation-scenarios-heading">Klicken übernimmt nur die Testfrage</h2>
          </div>
          <p>
            Jede Karte zeigt Persona und Ziel. Gesendet wird erst, wenn Sie im Testdialog auf „Senden“ klicken.
          </p>
        </section>

        <section className="evaluation-scenarios" aria-label="Beispielszenarien">
          {context.scenarios.map((scenario) => (
            <button
              key={scenario.key}
              type="button"
              onClick={() => {
                setInput(scenario.prompt);
                setStatusAnnouncement(`Beispieltext übernommen: ${scenario.title}. Er wurde noch nicht gesendet.`);
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="evaluation-scenario-card"
              aria-describedby={`scenario-${scenario.key}-prompt`}
            >
              <p>{scenario.category || "Synthetisches Szenario"}</p>
              <h2>{scenario.title}</h2>
              <span className="evaluation-scenario-card__persona">{scenario.persona || "Demo-Rolle"}</span>
              <span id={`scenario-${scenario.key}-prompt`}>
                <strong>Testfrage:</strong> {scenario.prompt}
              </span>
              {scenario.goal && <span><strong>Ziel:</strong> {scenario.goal}</span>}
            </button>
          ))}
        </section>

        <section className="evaluation-layout">
          <div className="evaluation-chat-card">
            <div className="evaluation-section-heading">
              <div>
                <p className="evaluation-eyebrow">Testdialog</p>
                <h2>Frage stellen und Antwort prüfen</h2>
              </div>
              {conversationId ? <span>Aktive Testsitzung</span> : <span>Noch nicht gestartet</span>}
            </div>
            <div className="evaluation-chat-log" aria-busy={loading}>
              {messages.length === 0 ? (
                <div className="evaluation-empty-state">
                  <h3>Starten Sie mit einer Beispielkarte oder eigener Testfrage.</h3>
                  <p>Die Antworten werden quellenbasiert geprüft. Ticketvorschauen bleiben im Demonstrator und werden nicht extern übermittelt.</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <article key={index} className={`evaluation-message evaluation-message--${message.role}`}>
                    <div className="evaluation-message__bubble">
                      <p>{message.content}</p>
                      {(message.sources || []).length > 0 && (
                        <div className="evaluation-message__sources">
                          <p>Quellen</p>
                          {message.sources?.map((source, sourceIndex) => (
                            <p key={sourceIndex}>
                              {source.publicUrl ? (
                                <a href={source.publicUrl} target="_blank" rel="noreferrer noopener">
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
                        <div className="evaluation-inline-note evaluation-inline-note--warning">
                          <strong>{message.handoffPreview.status}:</strong> {message.handoffPreview.summary}
                        </div>
                      )}
                      {message.ticketPreview && (
                        <div
                          ref={ticketPreviewRef}
                          tabIndex={-1}
                          className="evaluation-ticket-preview"
                          aria-labelledby={`ticket-preview-${index}`}
                        >
                          <p id={`ticket-preview-${index}`}>Demo-Supportfall Vorschau</p>
                          {message.ticketPreview.missingFields.length > 0 ? (
                            <p className="evaluation-ticket-preview__missing">
                              Fehlende Angaben: {message.ticketPreview.missingFields.map(ticketFieldLabel).join(", ")}
                            </p>
                          ) : (
                            <dl>
                              {Object.entries(message.ticketPreview.fields)
                                .filter(([key, value]) => key !== "reporterEmail" && Boolean(value))
                                .map(([key, value]) => (
                                  <div key={key}>
                                    <dt>{ticketFieldLabel(key)}</dt>
                                    <dd>{ticketFieldValue(key, String(value))}</dd>
                                  </div>
                                ))}
                            </dl>
                          )}
                          {message.ticketPreview.previewToken && (
                            <div className="evaluation-actions">
                              <button
                                type="button"
                                onClick={() => confirmTicket(message.ticketPreview as TicketPreview)}
                                disabled={ticketActionLoading}
                                className="evaluation-primary-button"
                              >
                                Demo-Ticket erstellen
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelTicket(message.ticketPreview as TicketPreview)}
                                disabled={ticketActionLoading}
                                className="evaluation-secondary-button"
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
              <div ref={ticketResultRef} tabIndex={-1} className="evaluation-status evaluation-status--success" role="status">
                {ticketResult}
              </div>
            )}
            {ticketCreated && (
              <div className="evaluation-handoff-card">
                <div className="evaluation-handoff-card__header">
                  <div>
                    <p>Signierte Demo-Übergabe</p>
                    <span>{handoffStatus?.message || "Noch keine Demo-Übergabe ausgeführt."}</span>
                    {handoffStatus?.externalNotice && <span>{handoffStatus.externalNotice}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={runSignedHandoff}
                    disabled={handoffLoading}
                    className="evaluation-primary-button"
                  >
                    {handoffLoading ? "Prüft..." : "Signierte Demo-Übergabe simulieren"}
                  </button>
                </div>
                {handoffStatus && handoffStatus.status !== "not_requested" && (
                  <dl className="evaluation-handoff-grid">
                    <div><dt>Demo-Referenz</dt><dd>{handoffStatus.demoReference || "Nicht verfügbar"}</dd></div>
                    <div><dt>Status</dt><dd>{handoffStatus.status}</dd></div>
                    <div><dt>Versuche</dt><dd>{handoffStatus.attemptCount ?? 0}</dd></div>
                    <div><dt>Signatur geprüft</dt><dd>{handoffStatus.signatureVerified ? "Ja" : "Nein"}</dd></div>
                    <div><dt>Duplikat sicher erkannt</dt><dd>{handoffStatus.duplicateRecognized ? "Ja" : "Nein"}</dd></div>
                    <div><dt>Empfangen</dt><dd>{formatDate(handoffStatus.receivedAt)}</dd></div>
                  </dl>
                )}
              </div>
            )}
            {error && (
              <div className="evaluation-status evaluation-status--error" role="alert">
                <p>{error}</p>
                {retryMessage && (
                  <button
                    type="button"
                    onClick={() => sendMessage(retryMessage)}
                    className="evaluation-primary-button"
                  >
                    Erneut versuchen
                  </button>
                )}
              </div>
            )}
            <div className="evaluation-composer">
              <label className="sr-only" htmlFor="evaluation-message">
                Testfrage
              </label>
              <textarea
                id="evaluation-message"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={2000}
                className="evaluation-composer__input"
                placeholder="Testfrage eingeben..."
                aria-describedby="evaluation-message-help"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="evaluation-primary-button evaluation-composer__button"
              >
                {loading ? "Sendet..." : "Senden"}
              </button>
            </div>
            <p id="evaluation-message-help" className="evaluation-help-text">
              Enter im Textfeld erzeugt Text. Nutzen Sie die Schaltfläche „Senden“, um die Testfrage zu übermitteln.
            </p>
          </div>

          <aside className="evaluation-side-panel">
            <div className="evaluation-card">
              <p className="evaluation-eyebrow">Sitzung</p>
              <h2>Werte dieser Testsitzung</h2>
              <dl className="evaluation-metrics">
                <div><dt>Fragen</dt><dd>{userQuestionCount}</dd></div>
                <div><dt>Mit Quellen</dt><dd>{sourcedAnswers}</dd></div>
                <div><dt>Wissenslücken</dt><dd>{knowledgeGaps}</dd></div>
                <div><dt>Übergaben</dt><dd>{handoffs}</dd></div>
              </dl>
            </div>
            <div className="evaluation-card">
              <p className="evaluation-eyebrow">Sicherheit</p>
              <h2>Technische Übersicht</h2>
              <ul className="evaluation-feature-list">
                {context.technicalFeatures.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
