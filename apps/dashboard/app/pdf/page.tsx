"use client";

import { useEffect, useState } from "react";
import { Topbar } from "../../components/layout/Topbar";
import { Button } from "../../components/shared/Button";
import { ErrorState } from "../../components/shared/ErrorState";
import { Select } from "../../components/shared/Select";

type Site = {
  id: string;
  name: string;
};

export default function PdfUploadPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [preselectedSiteId, setPreselectedSiteId] = useState("");
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

  async function submitPdf(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!siteId) {
      setErr("Bitte einen Kunden auswählen.");
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
    <div>
      <Topbar title="PDFs" />
      <div className="dashboard-page dashboard-page--md">
        {preselectedSiteId && (
          <div className="dashboard-copy dashboard-mb-16">
            Kunden-Kontext aktiv: <strong>{preselectedSiteId}</strong>
          </div>
        )}
        <form onSubmit={submitPdf} className="dashboard-card dashboard-stack dashboard-gap-12">
          <label className="dashboard-field">
            <div>Kunde</div>
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
            <div>PDF Datei</div>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="dashboard-control"
            />
          </label>

          <Button type="submit" disabled={loading}>
            {loading ? "Lade hoch..." : "PDF hochladen"}
          </Button>
        </form>

        {msg && <p className="dashboard-status dashboard-status--success dashboard-mb-16">{msg}</p>}
        {err && <ErrorState message={err} />}
      </div>
    </div>
  );
}
