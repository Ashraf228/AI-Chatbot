"use client";

import { useEffect, useState } from "react";

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

export default function ConversationsPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [siteId, setSiteId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadConversations() {
  setErr(null);

  const url = siteId
    ? `/api/conversations?siteId=${encodeURIComponent(siteId)}`
    : "/api/conversations";

  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    setErr("Ungültige Antwort von /api/conversations");
    return;
  }

  if (!r.ok) {
    setErr(typeof data === "string" ? data : JSON.stringify(data));
    return;
  }

  setItems(Array.isArray(data) ? data : []);
}

  async function loadMessages(id: string) {
  setErr(null);

  const r = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
  const text = await r.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    setErr("Ungültige Antwort von /api/conversations/[id]");
    return;
  }

  if (!r.ok) {
    setErr(typeof data === "string" ? data : JSON.stringify(data));
    return;
  }

  setSelectedId(id);
  setMessages(Array.isArray(data.messages) ? data.messages : []);
}

  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "30px auto", padding: 20, fontFamily: "system-ui" }}>
      <h1>Conversations</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          placeholder="Nach siteId filtern (z. B. kunde-1)"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          style={{ padding: 10, flex: 1 }}
        />
        <button onClick={loadConversations} style={{ padding: 10 }}>
          Laden
        </button>
      </div>

      {err && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20 }}>
        <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2>Liste</h2>

          {items.length === 0 ? (
            <p>Keine Conversations gefunden.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.id)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 10,
                    border: selectedId === conv.id ? "2px solid #111" : "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div><strong>{conv.site_id}</strong></div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    session: {conv.session_id.slice(0, 8)}...
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    messages: {conv.message_count}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    last active: {new Date(conv.last_active_at).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2>Nachrichten</h2>

          {!selectedId ? (
            <p>Wähle links eine Conversation aus.</p>
          ) : messages.length === 0 ? (
            <p>Keine Nachrichten gefunden.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: msg.role === "user" ? "#eef4ff" : "#f7f7f7",
                    border: "1px solid #ddd",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    {msg.role.toUpperCase()} — {new Date(msg.created_at).toLocaleString()}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}