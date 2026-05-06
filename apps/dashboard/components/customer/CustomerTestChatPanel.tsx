"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";

type CustomerTestChatPanelProps = {
  siteId: string;
};

type TestMessage = {
  role: "user" | "assistant";
  content: string;
};

type SiteTestConfig = {
  topTestQuestions: string[];
  lastTestQuestion: string;
  lastTestAnswer: string;
  lastTestFeedback: "helpful" | "wrong" | "";
  lastTestedAt: string;
};

const TEST_QUESTIONS = [
  "Was bietet ihr an?",
  "Wie kann ich Kontakt aufnehmen?",
  "Was ist der nächste Schritt?",
];

export function CustomerTestChatPanel({ siteId }: CustomerTestChatPanelProps) {
  const [sessionId, setSessionId] = useState("");
  const [siteConfig, setSiteConfig] = useState<SiteTestConfig>({
    topTestQuestions: [],
    lastTestQuestion: "",
    lastTestAnswer: "",
    lastTestFeedback: "",
    lastTestedAt: "",
  });
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState(TEST_QUESTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [savingTest, setSavingTest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSiteConfig() {
      const response = await fetch(`/api/widget/sites/${encodeURIComponent(siteId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return;
      }

      const topTestQuestions = Array.isArray(data.topTestQuestions)
        ? data.topTestQuestions.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      setSiteConfig({
        topTestQuestions,
        lastTestQuestion: data.lastTestQuestion || "",
        lastTestAnswer: data.lastTestAnswer || "",
        lastTestFeedback: data.lastTestFeedback || "",
        lastTestedAt: data.lastTestedAt || "",
      });

      if (topTestQuestions[0]) {
        setInput(topTestQuestions[0]);
      }
    }

    loadSiteConfig();
  }, [siteId]);

  const testQuestions = useMemo(
    () => (siteConfig.topTestQuestions.length > 0 ? siteConfig.topTestQuestions.slice(0, 5) : TEST_QUESTIONS),
    [siteConfig.topTestQuestions],
  );

  async function saveTestResult(input: {
    question: string;
    answer: string;
    feedback?: "helpful" | "wrong";
  }) {
    const testedAt = new Date().toISOString();
    const response = await fetch(`/api/widget/config/${encodeURIComponent(siteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastTestQuestion: input.question,
        lastTestAnswer: input.answer,
        lastTestFeedback: input.feedback,
        lastTestedAt: testedAt,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setSiteConfig((current) => ({
        ...current,
        lastTestQuestion: data.lastTestQuestion || input.question,
        lastTestAnswer: data.lastTestAnswer || input.answer,
        lastTestFeedback: data.lastTestFeedback || input.feedback || "",
        lastTestedAt: data.lastTestedAt || testedAt,
      }));
    }
  }

  async function sendTestMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) {
      setError("Bitte eine Testfrage eingeben.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    setMessages((current) => [...current, { role: "user", content: text }]);
    setInput("");

    const response = await fetch(`/api/widget/test-chat/${encodeURIComponent(siteId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, sessionId }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data?.message || "Testfrage konnte nicht gesendet werden.");
      setLoading(false);
      return;
    }

    setSessionId(data.sessionId || sessionId);
    const answer = data.answer || "Keine Antwort erhalten.";
    setMessages((current) => [
      ...current,
      { role: "assistant", content: answer },
    ]);
    await saveTestResult({ question: text, answer });
    setMessage("Testantwort gespeichert.");
    setLoading(false);
  }

  async function markFeedback(feedback: "helpful" | "wrong") {
    setSavingTest(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/widget/config/${encodeURIComponent(siteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastTestFeedback: feedback,
        lastTestedAt: new Date().toISOString(),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data?.message || "Feedback konnte nicht gespeichert werden.");
      setSavingTest(false);
      return;
    }

    setSiteConfig((current) => ({
      ...current,
      lastTestFeedback: data.lastTestFeedback || feedback,
      lastTestedAt: data.lastTestedAt || current.lastTestedAt,
    }));
    setMessage(feedback === "helpful" ? "Antwort als hilfreich markiert." : "Antwort als falsch markiert.");
    setSavingTest(false);
  }

  return (
    <section id="customer-test-chat" className="dashboard-card dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">Test-Chat</h2>
        <p className="dashboard-copy">
          Stelle echte Testfragen direkt gegen den Bot dieses Kunden. Das nutzt dieselbe Chat-Logik wie das Widget.
        </p>
      </div>

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        {messages.length === 0 ? (
          <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
            Noch keine Testnachricht gesendet.
          </p>
        ) : (
          messages.map((entry, index) => (
            <div
              key={`${entry.role}-${index}`}
              className={entry.role === "assistant" ? "dashboard-chat-message" : "dashboard-chat-message dashboard-chat-message--user"}
            >
              <strong>{entry.role === "assistant" ? "Bot" : "Mitarbeiter"}</strong>
              <p>{entry.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="dashboard-inline dashboard-wrap">
        {testQuestions.map((question) => (
          <Button
            key={question}
            type="button"
            variant="secondary"
            onClick={() => setInput(question)}
          >
            {question}
          </Button>
        ))}
      </div>

      {siteConfig.lastTestAnswer ? (
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <strong>Letzte gespeicherte Testantwort</strong>
          <p className="dashboard-copy dashboard-copy--muted">{siteConfig.lastTestQuestion}</p>
          <p>{siteConfig.lastTestAnswer}</p>
          <div className="dashboard-inline dashboard-wrap">
            <Button
              type="button"
              variant="secondary"
              onClick={() => markFeedback("helpful")}
              disabled={savingTest}
            >
              Antwort hilfreich
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => markFeedback("wrong")}
              disabled={savingTest}
            >
              Antwort falsch
            </Button>
          </div>
          {siteConfig.lastTestFeedback ? (
            <p className="dashboard-copy dashboard-copy--muted">
              Feedback: {siteConfig.lastTestFeedback === "helpful" ? "hilfreich" : "falsch"}
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={sendTestMessage} className="dashboard-stack dashboard-stack--sm">
        <label className="dashboard-field">
          <span className="dashboard-field-label">Testfrage</span>
          <textarea
            className="dashboard-textarea"
            rows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Frage eingeben, die ein Kunde stellen könnte..."
          />
        </label>

        <div className="dashboard-inline dashboard-wrap">
          <Button type="submit" disabled={loading}>
            {loading ? "Bot antwortet..." : "Testfrage senden"}
          </Button>
        </div>
      </form>

      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}
    </section>
  );
}
