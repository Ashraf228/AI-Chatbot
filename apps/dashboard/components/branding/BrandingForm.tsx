"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ColorPickerField } from "./ColorPickerField";
import { LogoUploadField } from "./LogoUploadField";
import { WidgetPreview } from "./WidgetPreview";

type BrandingFormProps = {
  siteId: string;
};

type SiteData = {
  companyName: string;
  botName: string;
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  welcomeMessage: string;
  privacyUrl: string;
};

export function BrandingForm({ siteId }: BrandingFormProps) {
  const [form, setForm] = useState<SiteData>({
    companyName: "",
    botName: "",
    logoUrl: "",
    brandColor: "#b55400",
    accentColor: "#fff0d9",
    welcomeMessage: "",
    privacyUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Branding konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      setForm({
        companyName: data.companyName || data.name || "",
        botName: data.botName || "",
        logoUrl: data.logoUrl || "",
        brandColor: data.brandColor || "#b55400",
        accentColor: data.accentColor || "#fff0d9",
        welcomeMessage: data.welcomeMessage || "",
        privacyUrl: data.privacyUrl || "",
      });
      setLoading(false);
    }

    load();
  }, [siteId]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const res = await fetch(`/api/widget/branding/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.message || "Branding konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    setMessage("Branding gespeichert.");
    setSaving(false);
  }

  if (loading) {
    return <div style={panelStyle}>Branding wird geladen...</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Branding</h2>
        <div style={{ display: "grid", gap: 14 }}>
          <Field
            label="Firmenname"
            value={form.companyName}
            onChange={(value) => setForm({ ...form, companyName: value })}
          />
          <Field
            label="Bot-Name"
            value={form.botName}
            onChange={(value) => setForm({ ...form, botName: value })}
          />
          <LogoUploadField
            value={form.logoUrl}
            onChange={(value) => setForm({ ...form, logoUrl: value })}
          />
          <ColorPickerField
            label="Brand Color"
            value={form.brandColor}
            onChange={(value) => setForm({ ...form, brandColor: value })}
          />
          <ColorPickerField
            label="Accent Color"
            value={form.accentColor}
            onChange={(value) => setForm({ ...form, accentColor: value })}
          />
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Willkommensnachricht</span>
            <textarea
              value={form.welcomeMessage}
              onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
              rows={4}
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            />
          </label>
          <Field
            label="Privacy URL"
            value={form.privacyUrl}
            onChange={(value) => setForm({ ...form, privacyUrl: value })}
          />

          <button onClick={save} disabled={saving} style={buttonStyle}>
            {saving ? "Speichert..." : "Branding speichern"}
          </button>

          {message && <div style={{ color: "#047857" }}>{message}</div>}
          {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
        </div>
      </div>

      <WidgetPreview {...form} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
      />
    </label>
  );
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};

const buttonStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};
