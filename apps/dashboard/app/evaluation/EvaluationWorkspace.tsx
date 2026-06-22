"use client";

import { useState } from "react";

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
  const [error, setError] = useState("");
  const [retryMessage, setRetryMessage] = useState("");

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
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: safeText(data.answer || ""),
          sources: Array.isArray(data.sources) ? data.sources : [],
          handoffPreview: data.handoffPreview || null,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
      setRetryMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
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
            <span className="rounded-full bg-slate-700 px-3 py-1">Ablauf: {formatDate(context.accountExpiresAt)}</span>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {context.scenarios.map((scenario) => (
            <button
              key={scenario.key}
              type="button"
              onClick={() => setInput(scenario.prompt)}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-left transition hover:bg-white/10"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Synthetisches Szenario</p>
              <h2 className="mt-2 text-lg font-semibold">{scenario.title}</h2>
              <p className="mt-3 text-sm text-slate-300">{scenario.prompt}</p>
            </button>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white p-4 text-slate-950">
            <div className="min-h-[360px] space-y-4 rounded-2xl bg-slate-50 p-4">
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
                    </div>
                  </article>
                ))
              )}
            </div>
            {error && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
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
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={2000}
                className="min-h-20 flex-1 rounded-2xl border border-slate-200 p-3 text-sm"
                placeholder="Testfrage eingeben..."
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
