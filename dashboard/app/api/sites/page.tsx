"use client";

import { useEffect, useMemo, useState } from "react";

type Site = {
  id: string;
  tenant_id: string;
  name: string;
  allowed_domains: string[];
  public_key: string;
};

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState({
    id: "",
    tenantId: "t_default",
    name: "",
    domain: "",
  });
  const [err, setErr] = useState<string | null>(null);

  const embed = useMemo(() => {
    const s = sites.find((x) => x.id === form.id) || null;
    if (!s) return "";

    return `<script>
  window.SSB_CHAT = {
    siteId: "${s.id}",
    publicKey: "${s.public_key}",
    apiBase: "http://localhost:5000"
  };
</script>
<script src="http://localhost:8080/widget.js" defer></script>`;
  }, [sites, form.id]);

  async function load() {
    const r = await fetch("/api/sites", { cache: "no-store" });
    const data = await r.json();
    setSites(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createSite(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

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

    if (!r.ok) {
      const text = await r.text();
      setErr(text);
      return;
    }

    setForm({
      id: "",
      tenantId: "t_default",
      name: "",
      domain: "",
    });

    await load();
  }

  return (
    <div style={{ maxWidth: 980, margin: "30px auto", fontFamily: "system-ui" }}>
      <h1>Sites</h1>

      <form
        onSubmit={createSite}
        style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
      >
        <input
          placeholder="siteId (z. B. kunde-1)"
          value={form.id}
          onChange={(e) => setForm({ ...form, id: e.target.value })}
        />
        <input
          placeholder="tenantId (z. B. t_default)"
          value={form.tenantId}
          onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
        />
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Domain (z. B. kunde1.de oder localhost)"
          value={form.domain}
          onChange={(e) => setForm({ ...form, domain: e.target.value })}
        />

        <button type="submit" style={{ gridColumn: "1 / -1", padding: 10 }}>
          Site erstellen
        </button>
      </form>

      {err && (
        <pre style={{ color: "crimson", whiteSpace: "pre-wrap", marginTop: 12 }}>
          {err}
        </pre>
      )}

      <h2 style={{ marginTop: 24 }}>Liste</h2>
      <ul>
        {sites.map((s) => (
          <li key={s.id} style={{ marginBottom: 10 }}>
            <b>{s.id}</b> — {s.name} — tenant: {s.tenant_id} — domains:{" "}
            {Array.isArray(s.allowed_domains) ? s.allowed_domains.join(", ") : ""}
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              public_key: {s.public_key}
            </div>
          </li>
        ))}
      </ul>

      <h2>Embed Code</h2>
      <textarea
        value={embed}
        readOnly
        style={{ width: "100%", height: 160, marginTop: 10 }}
      />
    </div>
  );
}