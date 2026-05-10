"use client";

import { useEffect, useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { Select } from "../shared/Select";
import { EmptyStateCard } from "../shared/EmptyStateCard";
import { CompactMetricCard } from "../shared/CompactMetricCard";
import { StatusBadge } from "../inbox/StatusBadge";
import { getDecisionLabel } from "../../lib/labels";

type Conversation = {
  id: string;
  tenant_id: string;
  site_id: string;
  session_id: string;
  created_at: string;
  last_active_at: string;
  message_count: string;
  last_message?: string;
  last_role?: string;
  has_lead?: boolean;
  has_handoff?: boolean;
  has_ticket?: boolean;
  tool_count?: string;
  decision_type?: string | null;
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
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
    return value.message;
  }

  return typeof value === "string" ? value : "Daten konnten nicht geladen werden.";
}

function conversationStatus(item: Conversation) {
  if (item.has_ticket) return "ticket";
  if (item.has_handoff) return "handoff";
  if (item.last_role === "user") return "unanswered";
  if (item.has_lead) return "lead";
  return "answered";
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
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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

  const filteredItems = items.filter((item) => {
    if (filter === "with_lead" && !item.has_lead) return false;
    if (filter === "handoff" && !item.has_handoff) return false;
    if (filter === "ticket" && !item.has_ticket) return false;
    if (filter === "unanswered") {
      if (item.last_role !== "user") return false;
    }
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [item.site_id, item.session_id, item.last_message || "", item.decision_type || ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const leadCount = items.filter((item) => item.has_lead).length;
  const handoffCount = items.filter((item) => item.has_handoff).length;
  const unansweredCount = items.filter((item) => item.last_role === "user").length;
  const ticketCount = items.filter((item) => item.has_ticket).length;

  return (
    <div className="dashboard-stack">
      <div className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
        <div className="dashboard-grid dashboard-grid--metrics-4 dashboard-gap-12">
          <CompactMetricCard label="Chats" value={items.length} />
          <CompactMetricCard label="Mit Anfrage" value={leadCount} />
          <CompactMetricCard label="Übergaben" value={handoffCount} />
          <CompactMetricCard label="Tickets" value={ticketCount} />
          <CompactMetricCard label="Unbeantwortet" value={unansweredCount} />
        </div>
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
        <div className="dashboard-grid dashboard-grid--two" style={{ gap: 12 }}>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Status filtern</span>
            <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Alle Chats</option>
              <option value="with_lead">Mit Anfrage</option>
              <option value="handoff">Übergabe nötig</option>
              <option value="ticket">Ticket erstellt</option>
              <option value="unanswered">Unbeantwortet</option>
            </Select>
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Suche</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nachricht, Session, Entscheidung"
            />
          </label>
        </div>

        {lockedSiteId ? (
          <p className="dashboard-copy dashboard-copy--muted">
            Diese Ansicht ist auf den aktuellen Kunden begrenzt.
          </p>
        ) : null}

        {err && <ErrorState message={err} />}
      </div>

      <div className="conversation-ops-grid">
        <div className="dashboard-card dashboard-card--compact">
          <h2 className="dashboard-card-title">Chats</h2>

          {filteredItems.length === 0 ? (
            <EmptyStateCard
              title={lockedSiteId ? "Noch keine Gespräche vorhanden" : "Keine Chats gefunden"}
              description="Neue Gespräche erscheinen hier, sobald das Widget genutzt wird."
            />
          ) : (
            <div className="dashboard-conversation-list">
              {filteredItems.map((conv) => (
                <div key={conv.id}>
                  <button
                    onClick={() => loadMessages(conv.id)}
                    className={`dashboard-conversation-item ${selectedId === conv.id ? "is-selected" : ""}`}
                  >
                    <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
                      <strong>{conv.session_id ? `Besucher ${conv.session_id.slice(0, 8)}` : conv.site_id}</strong>
                      <StatusBadge status={conversationStatus(conv)} />
                    </div>
                    {!lockedSiteId ? <div className="dashboard-meta">{conv.site_id}</div> : null}
                    {conv.last_message ? (
                      <div className="dashboard-meta dashboard-breakword">{conv.last_message}</div>
                    ) : null}
                    <div className="dashboard-inline dashboard-wrap" style={{ gap: 6, marginTop: 8 }}>
                      {conv.has_lead ? <span className="dashboard-badge">Anfrage erkannt</span> : null}
                      {Number(conv.tool_count || 0) > 0 ? <span className="dashboard-badge">Aktionen: {conv.tool_count}</span> : null}
                      {getDecisionLabel(conv.decision_type) ? <span className="dashboard-badge">{getDecisionLabel(conv.decision_type)}</span> : null}
                      <span className="dashboard-badge">{conv.message_count} Nachrichten</span>
                    </div>
                    <div className="dashboard-meta dashboard-meta--subtle">
                      {new Date(conv.last_active_at).toLocaleString("de-DE")}
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="danger"
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

        <div className="dashboard-card dashboard-card--compact">
          <h2 className="dashboard-card-title">Nachrichten</h2>

          {!selectedId ? (
            <EmptyStateCard title="Chat auswählen" description="Wähle links ein Gespräch für die Vorschau aus." />
          ) : messages.length === 0 ? (
            <EmptyStateCard title="Keine Nachrichten gefunden" />
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
                    {msg.role === "user" ? "Besucher" : "Assistent"} · {new Date(msg.created_at).toLocaleString("de-DE")}
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
