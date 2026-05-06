"use client";

import { useEffect, useState } from "react";
import { Button } from "../shared/Button";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";

type Conversation = {
  id: string;
  tenant_id: string;
  site_id: string;
  session_id: string;
  created_at: string;
  last_active_at: string;
  message_count: string;
};

type Message = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type ConversationMessagesResponse = {
  messages?: Message[];
};

type ConversationPanelProps = {
  initialSiteId?: string;
  lockedSiteId?: string;
};

function parseJsonResponse<T>(text: string): T | null {
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}

function toErrorMessage(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function ConversationPanel({
  initialSiteId = "",
  lockedSiteId,
}: ConversationPanelProps) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [siteId, setSiteId] = useState(initialSiteId);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadConversations(currentSiteId = siteId) {
    setErr(null);

    const url = currentSiteId
      ? `/api/conversations?siteId=${encodeURIComponent(currentSiteId)}`
      : "/api/conversations";

    const r = await fetch(url, { cache: "no-store" });
    const text = await r.text();

    let data: Conversation[] | Record<string, unknown> | null = null;
    try {
      data = parseJsonResponse<Conversation[] | Record<string, unknown>>(text);
    } catch {
      setErr("Ungültige Antwort von /api/conversations");
      return;
    }

    if (!r.ok) {
      setErr(toErrorMessage(data));
      return;
    }

    setItems(Array.isArray(data) ? data : []);
  }

  async function loadMessages(id: string) {
    setErr(null);

    const r = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    const text = await r.text();

    let data: ConversationMessagesResponse | Record<string, unknown> | null = null;
    try {
      data = parseJsonResponse<ConversationMessagesResponse | Record<string, unknown>>(text);
    } catch {
      setErr("Ungültige Antwort von /api/conversations/[id]");
      return;
    }

    if (!r.ok) {
      setErr(toErrorMessage(data));
      return;
    }

    setSelectedId(id);
    setMessages(
      data && typeof data === "object" && "messages" in data && Array.isArray(data.messages)
        ? data.messages
        : [],
    );
  }

  async function deleteConversation(id: string) {
    setErr(null);
    const r = await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
    });
    const text = await r.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = parseJsonResponse<Record<string, unknown>>(text);
    } catch {
      setErr("Ungültige Antwort beim Löschen");
      return;
    }
    if (!r.ok) {
      setErr(toErrorMessage(data));
      return;
    }
    if (selectedId === id) {
      setSelectedId("");
      setMessages([]);
    }
    await loadConversations(lockedSiteId || siteId);
  }

  function exportConversations() {
    const currentSiteId = lockedSiteId || siteId;
    const params = new URLSearchParams();
    if (currentSiteId) params.set("siteId", currentSiteId);
    window.location.href = `/api/conversations/export?${params.toString()}`;
  }

  useEffect(() => {
    if (lockedSiteId) {
      setSiteId(lockedSiteId);
      loadConversations(lockedSiteId);
      return;
    }

    loadConversations(initialSiteId);
  }, [initialSiteId, lockedSiteId]);

  return (
    <div className="dashboard-stack">
      <div className="dashboard-card">
        <div className="dashboard-inline dashboard-gap-12 dashboard-mb-16">
          <Input
            placeholder="Nach Kunde filtern"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            style={{ flex: 1 }}
            disabled={Boolean(lockedSiteId)}
          />
          <Button onClick={() => loadConversations(lockedSiteId || siteId)}>Aktualisieren</Button>
          <Button type="button" variant="secondary" onClick={exportConversations}>
            Chats exportieren
          </Button>
        </div>

        {lockedSiteId ? (
          <p className="dashboard-copy dashboard-copy--muted">
            Diese Ansicht ist auf den aktuellen Kunden begrenzt.
          </p>
        ) : null}

        {err && <ErrorState message={err} />}
      </div>

      <div className="dashboard-grid dashboard-grid--split">
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Chats</h2>

          {items.length === 0 ? (
            <EmptyState title="Keine Chats gefunden." />
          ) : (
            <div className="dashboard-conversation-list">
              {items.map((conv) => (
                <div key={conv.id}>
                  <button
                    onClick={() => loadMessages(conv.id)}
                    className={`dashboard-conversation-item ${selectedId === conv.id ? "is-selected" : ""}`}
                  >
                    <div>
                      <strong>{conv.site_id}</strong>
                    </div>
                    <div className="dashboard-meta">session: {conv.session_id.slice(0, 8)}...</div>
                    <div className="dashboard-meta">Nachrichten: {conv.message_count}</div>
                    <div className="dashboard-meta dashboard-meta--subtle">
                      zuletzt aktiv: {new Date(conv.last_active_at).toLocaleString()}
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="dashboard-mt-4"
                  >
                    Löschen
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Nachrichten</h2>

          {!selectedId ? (
            <EmptyState title="Wähle links einen Chat aus." />
          ) : messages.length === 0 ? (
            <EmptyState title="Keine Nachrichten gefunden." />
          ) : (
            <div className="dashboard-stack">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`dashboard-message-card ${
                    msg.role === "user" ? "dashboard-message-card--user" : "dashboard-message-card--assistant"
                  }`}
                >
                  <div className="dashboard-message-head">
                    {msg.role.toUpperCase()} — {new Date(msg.created_at).toLocaleString()}
                  </div>
                  <div className="dashboard-prewrap">{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
