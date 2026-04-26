"use client";

import { useEffect, useState } from "react";
import { Button } from "../shared/Button";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";

type KnowledgeItem = {
  id: string;
  type: string;
  title: string;
  sourceUrl: string;
  createdAt: string;
  chunkCount: number;
  faqItems: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
};

export function KnowledgeManager({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqQuestionDraft, setFaqQuestionDraft] = useState("");
  const [faqAnswerDraft, setFaqAnswerDraft] = useState("");
  const [savingFaqId, setSavingFaqId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/knowledge?siteId=${encodeURIComponent(siteId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      setError(data?.message || "Knowledge-Inhalte konnten nicht geladen werden.");
      setLoading(false);
      return;
    }

    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [siteId]);

  async function removeItem(documentId: string) {
    setDeletingId(documentId);
    setError(null);
    const res = await fetch(`/api/knowledge/${documentId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.message || "Eintrag konnte nicht gelöscht werden.");
      setDeletingId(null);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== documentId));
    setDeletingId(null);
  }

  function startEditFaq(id: string, question: string, answer: string) {
    setEditingFaqId(id);
    setFaqQuestionDraft(question);
    setFaqAnswerDraft(answer);
    setError(null);
  }

  function cancelEditFaq() {
    setEditingFaqId(null);
    setFaqQuestionDraft("");
    setFaqAnswerDraft("");
  }

  async function saveFaq(itemId: string, documentId: string) {
    setSavingFaqId(itemId);
    setError(null);
    const res = await fetch(`/api/knowledge/faq/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: faqQuestionDraft,
        a: faqAnswerDraft,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.message || "FAQ konnte nicht gespeichert werden.");
      setSavingFaqId(null);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id !== documentId
          ? item
          : {
              ...item,
              faqItems: item.faqItems.map((faq) =>
                faq.id === itemId
                  ? {
                      ...faq,
                      question: faqQuestionDraft,
                      answer: faqAnswerDraft,
                    }
                  : faq,
              ),
            },
      ),
    );
    setSavingFaqId(null);
    cancelEditFaq();
  }

  const pdfItems = items.filter((item) => item.type === "pdf");
  const faqItems = items.filter((item) => item.type === "faq");

  return (
    <div className="dashboard-stack">
      {error ? <ErrorState message={error} /> : null}

      <div className="dashboard-card">
        <h2 className="dashboard-card-title">Hochgeladene PDFs</h2>
        {loading ? (
          <p className="dashboard-copy">Lade PDFs...</p>
        ) : pdfItems.length === 0 ? (
          <EmptyState title="Keine PDFs für diese Site vorhanden." />
        ) : (
          <div className="dashboard-stack dashboard-stack--sm">
            {pdfItems.map((item) => (
              <div key={item.id} className="dashboard-card">
                <div className="dashboard-inline" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <h3 className="dashboard-card-title dashboard-card-title--sm">{item.title || "PDF"}</h3>
                    <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                      {item.chunkCount} Chunks · {new Date(item.createdAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => removeItem(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? "Löscht..." : "Löschen"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card">
        <h2 className="dashboard-card-title">Eingetragene FAQs</h2>
        {loading ? (
          <p className="dashboard-copy">Lade FAQs...</p>
        ) : faqItems.length === 0 ? (
          <EmptyState title="Keine FAQ-Einträge für diese Site vorhanden." />
        ) : (
          <div className="dashboard-stack dashboard-stack--sm">
            {faqItems.map((item) => (
              <div key={item.id} className="dashboard-card">
                <div className="dashboard-inline" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <h3 className="dashboard-card-title dashboard-card-title--sm">{item.title || "FAQ"}</h3>
                    <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                      {item.faqItems.length} Einträge · {new Date(item.createdAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => removeItem(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? "Löscht..." : "Löschen"}
                  </Button>
                </div>
                {item.faqItems.length > 0 ? (
                  <div className="dashboard-stack dashboard-stack--sm" style={{ marginTop: 14 }}>
                    {item.faqItems.map((faq, index) => (
                      <div key={faq.id} className="dashboard-card">
                        {editingFaqId === faq.id ? (
                          <div className="dashboard-stack dashboard-stack--sm">
                            <Input
                              value={faqQuestionDraft}
                              onChange={(e) => setFaqQuestionDraft(e.target.value)}
                              placeholder="Frage"
                            />
                            <textarea
                              className="dashboard-textarea"
                              value={faqAnswerDraft}
                              onChange={(e) => setFaqAnswerDraft(e.target.value)}
                              placeholder="Antwort"
                              style={{ minHeight: 120 }}
                            />
                            <div className="dashboard-inline" style={{ gap: 10 }}>
                              <Button
                                onClick={() => saveFaq(faq.id, item.id)}
                                disabled={savingFaqId === faq.id}
                              >
                                {savingFaqId === faq.id ? "Speichert..." : "Speichern"}
                              </Button>
                              <Button variant="ghost" onClick={cancelEditFaq}>
                                Abbrechen
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="dashboard-inline" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div>
                              <strong>{faq.question}</strong>
                              <p className="dashboard-copy" style={{ marginBottom: 0, marginTop: 4 }}>
                                {faq.answer}
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              onClick={() => startEditFaq(faq.id, faq.question, faq.answer)}
                            >
                              Bearbeiten
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
