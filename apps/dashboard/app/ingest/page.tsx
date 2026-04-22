"use client";

import { useEffect, useState } from "react";
import { Topbar } from "../../components/layout/Topbar";
import { Button } from "../../components/shared/Button";
import { ErrorState } from "../../components/shared/ErrorState";
import { Input } from "../../components/shared/Input";
import { Select } from "../../components/shared/Select";

type Site = {
  id: string;
  name: string;
};

export default function IngestPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [preselectedSiteId, setPreselectedSiteId] = useState("");
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

    if (preselectedSiteId && items.some((item) => item.id === preselectedSiteId)) {
      setSiteId(preselectedSiteId);
      return;
    }

    if (items.length > 0 && !siteId) {
      setSiteId(items[0].id);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = new URLSearchParams(window.location.search).get("siteId") || "";
    setPreselectedSiteId(value);
  }, []);

  useEffect(() => {
    loadSites();
  }, [preselectedSiteId]);

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

      setMsg(
        `FAQ erfolgreich gespeichert. Document ID: ${data.documentId}, inserted: ${data.inserted}`
      );
      setQ("");
      setA("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Topbar title="FAQ Ingest" />
      <div className="dashboard-page dashboard-page--md">
        {preselectedSiteId && (
          <div className="dashboard-copy dashboard-mb-16">
            Site-Kontext aktiv: <strong>{preselectedSiteId}</strong>
          </div>
        )}
        <form onSubmit={submitFaq} className="dashboard-card dashboard-stack dashboard-gap-12">
          <label className="dashboard-field">
            <div>Site</div>
            <Select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.id} — {site.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="dashboard-field">
            <div>Titel</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="dashboard-field">
            <div>Frage</div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="z. B. Wie lange dauert der Versand?"
            />
          </label>

          <label className="dashboard-field">
            <div>Antwort</div>
            <textarea
              className="dashboard-textarea"
              value={a}
              onChange={(e) => setA(e.target.value)}
              placeholder="z. B. 2–4 Werktage."
              style={{ minHeight: 140 }}
            />
          </label>

          <Button type="submit" disabled={loading}>
            {loading ? "Speichere..." : "FAQ speichern"}
          </Button>
        </form>

        {msg && <p className="dashboard-status dashboard-status--success dashboard-mb-16">{msg}</p>}
        {err && <ErrorState message={err} />}
      </div>
    </div>
  );
}
