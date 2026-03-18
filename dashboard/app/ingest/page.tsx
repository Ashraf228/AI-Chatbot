"use client";

import { useEffect, useState } from "react";

type Site = {
  id: string;
  name: string;
};

export default function IngestPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("FAQ");
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSites() {
    const r = await fetch("/api/sites", { cache: "no-store" });
    const data = await r.json();

    if (!r.ok) {
      setErr(typeof data === "string" ? data : JSON.stringify(data));
      return;
    }

    const items = Array.isArray(data) ? data : [];
    setSites(items);

    if (items.length > 0 && !siteId) {
      setSiteId(items[0].id);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  async function submitFaq(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const body = {
        siteId,
        title,
        items: [{ q, a }],
      };

      const r = await fetch("/api/ingest/faq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setErr(typeof data === "string" ? data : JSON.stringify(data));
        return;
      }

      setMsg(`FAQ erfolgreich gespeichert. Document ID: ${data.documentId}, inserted: ${data.inserted}`);
      setQ("");
      setA("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui", padding: 20 }}>
      <h1>FAQ Ingest</h1>

      <form
        onSubmit={submitFaq}
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <label>
          <div>Site</div>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.id} — {site.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div>Titel</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          <div>Frage</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="z. B. Wie lange dauert der Versand?"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          <div>Antwort</div>
          <textarea
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="z. B. 2–4 Werktage."
            style={{ width: "100%", height: 140, padding: 10, marginTop: 6 }}
          />
        </label>

        <button type="submit" disabled={loading} style={{ padding: 12, cursor: "pointer" }}>
          {loading ? "Speichere..." : "FAQ speichern"}
        </button>
      </form>

      {msg && <p style={{ color: "green", marginTop: 16 }}>{msg}</p>}
      {err && (
        <pre style={{ color: "crimson", whiteSpace: "pre-wrap", marginTop: 16 }}>
          {err}
        </pre>
      )}
    </div>
  );
}