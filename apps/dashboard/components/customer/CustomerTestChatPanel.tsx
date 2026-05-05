"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";

type CustomerTestChatPanelProps = {
  siteId: string;
};

type TestMessage = {
  role: "user" | "assistant";
  content: string;
};

const TEST_QUESTIONS = [
  "Was bietet ihr an?",
  "Wie kann ich Kontakt aufnehmen?",
  "Was ist der nächste Schritt?",
];

export function CustomerTestChatPanel({ siteId }: CustomerTestChatPanelProps) {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState(TEST_QUESTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [savingTest, setSavingTest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setMessages((current) => [
      ...current,
      { role: "assistant", content: data.answer || "Keine Antwort erhalten." },
    ]);
    setLoading(false);
  }

  async function markTested() {
    setSavingTest(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/widget/config/${encodeURIComponent(siteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastTestedAt: new Date().toISOString() }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data?.message || "Test konnte nicht markiert werden.");
      setSavingTest(false);
      return;
    }

    setMessage("Test als erledigt markiert.");
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
        {TEST_QUESTIONS.map((question) => (
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
          <Button type="button" variant="secondary" onClick={markTested} disabled={savingTest}>
            {savingTest ? "Speichert..." : "Als getestet markieren"}
          </Button>
        </div>
      </form>

      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}
    </section>
  );
}
