"use client";

import { useEffect, useState } from "react";
import { ColorPickerField } from "./ColorPickerField";
import { LogoUploadField } from "./LogoUploadField";
import { WidgetPreview } from "./WidgetPreview";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";
import { BRANDING_FONT_OPTIONS } from "../../lib/branding-fonts";

type BrandingFormProps = {
  siteId: string;
};

type SiteData = {
  companyName: string;
  botName: string;
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  fontFamily: string;
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
    fontFamily: "system",
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
        fontFamily: data.fontFamily || "system",
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

    setMessage("Design gespeichert.");
    setSaving(false);
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="dashboard-grid dashboard-grid--form-preview">
      <div className="dashboard-card">
        <h2 className="dashboard-card-title">Design</h2>
        <div className="dashboard-stack">
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
            label="Hauptfarbe"
            value={form.brandColor}
            onChange={(value) => setForm({ ...form, brandColor: value })}
          />
          <ColorPickerField
            label="Akzentfarbe"
            value={form.accentColor}
            onChange={(value) => setForm({ ...form, accentColor: value })}
          />
          <label className="dashboard-field">
            <span className="dashboard-field-label">Schriftart</span>
            <Select
              value={form.fontFamily}
              onChange={(e) => setForm({ ...form, fontFamily: e.target.value })}
            >
              {BRANDING_FONT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Willkommensnachricht</span>
            <textarea
              className="dashboard-textarea"
              value={form.welcomeMessage}
              onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
              rows={4}
            />
          </label>
          <Field
            label="Datenschutz-URL"
            value={form.privacyUrl}
            onChange={(value) => setForm({ ...form, privacyUrl: value })}
          />

          <Button onClick={save} disabled={saving}>
            {saving ? "Speichert..." : "Design speichern"}
          </Button>

          {message && <p className="dashboard-status dashboard-status--success">{message}</p>}
          {error && <ErrorState message={error} />}
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
    <label className="dashboard-field">
      <span className="dashboard-field-label">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
