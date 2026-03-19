"use client";

import { useEffect, useState } from "react";

type Site = {
  id: string;
  name: string;
};

export default function PdfUploadPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [file, setFile] = useState<File | null>(null);
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

  async function submitPdf(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!siteId) {
      setErr("Bitte eine Site auswählen.");
      return;
    }

    if (!file) {
      setErr("Bitte eine PDF auswählen.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("siteId", siteId);
      formData.append("file", file);

      const r = await fetch("/api/ingest/pdf", {
        method: "POST",
        body: formData,
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setErr(typeof data === "string" ? data : JSON.stringify(data));
        return;
      }

      setMsg(
        `PDF erfolgreich verarbeitet. Document ID: ${data.documentId}, Chunks: ${data.chunks}, Inserted: ${data.inserted}`
      );
      setFile(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "30px auto", fontFamily: "system-ui", padding: 20 }}>
      <h1>PDF Upload</h1>

      <form
        onSubmit={submitPdf}
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
          <div>PDF Datei</div>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ marginTop: 6 }}
          />
        </label>

        <button type="submit" disabled={loading} style={{ padding: 12, cursor: "pointer" }}>
          {loading ? "Lade hoch..." : "PDF hochladen"}
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