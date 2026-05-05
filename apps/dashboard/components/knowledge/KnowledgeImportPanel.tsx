"use client";

import { useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";

type KnowledgeImportPanelProps = {
  siteId: string;
  onImported?: () => void;
};

export function KnowledgeImportPanel({ siteId, onImported }: KnowledgeImportPanelProps) {
  const [title, setTitle] = useState("FAQ");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function submitFaq(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!question.trim() || !answer.trim()) {
      setError("Bitte Frage und Antwort ausfüllen.");
      return;
    }

    setSavingKey("faq");

    try {
      const response = await fetch("/api/ingest/faq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId,
          title: title.trim() || "FAQ",
          items: [{ q: question.trim(), a: answer.trim() }],
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "FAQ konnte nicht gespeichert werden.");
        return;
      }

      setQuestion("");
      setAnswer("");
      setMessage("FAQ gespeichert.");
      onImported?.();
    } finally {
      setSavingKey(null);
    }
  }

  async function submitPdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!file) {
      setError("Bitte eine PDF auswählen.");
      return;
    }

    setSavingKey("pdf");

    try {
      const formData = new FormData();
      formData.append("siteId", siteId);
      formData.append("file", file);

      const response = await fetch("/api/ingest/pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "PDF konnte nicht verarbeitet werden.");
        return;
      }

      setFile(null);
      setMessage("PDF verarbeitet.");
      onImported?.();
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="dashboard-card dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">Wissen hinzufügen</h2>
        <p className="dashboard-copy">
          Ergänze direkt im Kundenbereich neue FAQ-Antworten oder lade PDF-Dokumente hoch.
        </p>
      </div>

      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="dashboard-grid dashboard-grid--two" style={{ gap: 16 }}>
        <form onSubmit={submitFaq} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <h3 className="dashboard-card-title dashboard-card-title--sm">FAQ oder Text</h3>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Titel</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Frage</span>
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="z. B. Wie läuft die Terminvergabe?"
            />
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Antwort</span>
            <textarea
              className="dashboard-textarea"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Antwort für den Bot eintragen"
              style={{ minHeight: 140 }}
            />
          </label>
          <Button type="submit" disabled={savingKey === "faq"}>
            {savingKey === "faq" ? "Speichert..." : "FAQ speichern"}
          </Button>
        </form>

        <form onSubmit={submitPdf} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <h3 className="dashboard-card-title dashboard-card-title--sm">PDF hochladen</h3>
          <label className="dashboard-field">
            <span className="dashboard-field-label">PDF-Datei</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="dashboard-control"
            />
          </label>
          <Button type="submit" disabled={savingKey === "pdf"}>
            {savingKey === "pdf" ? "Lädt hoch..." : "PDF hochladen"}
          </Button>
        </form>
      </div>
    </section>
  );
}
