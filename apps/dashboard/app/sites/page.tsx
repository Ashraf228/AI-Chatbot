"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "../../components/layout/Topbar";

type Site = {
  id: string;
  tenant_id: string | null;
  name: string;
  allowed_domains: string[];
  public_key: string | null;
};

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [form, setForm] = useState({
    id: "",
    tenantId: "t_default",
    name: "",
    domain: "localhost",
  });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadSites() {
    setErr(null);

    const r = await fetch("/api/sites", { cache: "no-store" });
    const data = await r.json();

    if (!r.ok) {
      setErr(typeof data === "string" ? data : JSON.stringify(data));
      return;
    }

    const items = Array.isArray(data) ? data : [];
    setSites(items);

    if (!selectedSiteId && items.length > 0) {
      setSelectedSiteId(items[0].id);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  const embedCode = useMemo(() => {
    if (!selectedSite) return "";

    const loaderUrl =
      (typeof window !== "undefined" && (window as any).__NEXT_DATA__
        ? (process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js")
        : "http://localhost:8080/loader.js");

    return `<script src="${loaderUrl}" data-site-key="${selectedSite.id}" defer></script>`;
  }, [selectedSite]);

  async function createSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const body = {
      id: form.id.trim(),
      tenantId: form.tenantId.trim(),
      name: form.name.trim(),
      allowedDomains: [form.domain.trim()].filter(Boolean),
      config: {},
    };

    const r = await fetch("/api/sites", {
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

    setMsg("Site erfolgreich erstellt.");
    setForm({
      id: "",
      tenantId: "t_default",
      name: "",
      domain: "localhost",
    });

    await loadSites();

    if (data?.id) {
      setSelectedSiteId(data.id);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setErr(null);

      setTimeout(() => {
        setCopied(null);
      }, 2000);
    } catch {
      setErr(`${label} konnte nicht kopiert werden.`);
    }
  }

  return (
    <div>
      <Topbar title="Sites" />
      <div style={{ maxWidth: 1100, padding: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1fr) minmax(360px, 1.2fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div>
            <h2>Neue Site anlegen</h2>

            <form
              onSubmit={createSite}
              style={{
                display: "grid",
                gap: 10,
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <input
                placeholder="siteId (z. B. kunde-4)"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                style={{ padding: 10 }}
              />

              <input
                placeholder="tenantId (z. B. t_default)"
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                style={{ padding: 10 }}
              />

              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{ padding: 10 }}
              />

              <input
                placeholder="Domain (z. B. localhost oder kunde.de)"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                style={{ padding: 10 }}
              />

              <button type="submit" style={{ padding: 12, cursor: "pointer" }}>
                Site erstellen
              </button>
            </form>

            {err && (
              <pre style={{ color: "crimson", whiteSpace: "pre-wrap", marginTop: 12 }}>
                {err}
              </pre>
            )}

            {msg && <p style={{ color: "green", marginTop: 12 }}>{msg}</p>}
          </div>

          <div>
            <h2>Vorhandene Sites</h2>

            <div
              style={{
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              {sites.length === 0 ? (
                <p>Keine Sites vorhanden.</p>
              ) : (
                <>
                  <select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    style={{ width: "100%", padding: 10, marginBottom: 16 }}
                  >
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.id} — {site.name}
                      </option>
                    ))}
                  </select>

                  {selectedSite && (
                    <div style={{ display: "grid", gap: 10 }}>
                      <InfoRow label="Name" value={selectedSite.name} />
                      <InfoRow label="Tenant" value={selectedSite.tenant_id || "-"} />
                      <InfoRow
                        label="Domains"
                        value={selectedSite.allowed_domains.join(", ") || "-"}
                      />
                      <InfoRow
                        label="Public Key"
                        value={selectedSite.public_key || "nicht vorhanden"}
                      />

                      {selectedSite.public_key && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyText(selectedSite.public_key || "", "Public Key")}
                            style={{ padding: 10, cursor: "pointer" }}
                          >
                            Public Key kopieren
                          </button>

                          <button
                            type="button"
                            onClick={() => copyText(embedCode, "Embed Code")}
                            style={{ padding: 10, cursor: "pointer" }}
                          >
                            Embed Code kopieren
                          </button>

                          <textarea
                            readOnly
                            value={embedCode}
                            style={{
                              width: "100%",
                              minHeight: 210,
                              marginTop: 8,
                              padding: 12,
                              fontFamily: "ui-monospace, SFMono-Regular, monospace",
                              fontSize: 13,
                            }}
                          />
                        </>
                      )}

                      {copied && <p style={{ color: "green", margin: 0 }}>{copied} kopiert.</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 12,
        alignItems: "start",
      }}
    >
      <strong>{label}</strong>
      <span style={{ wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}
