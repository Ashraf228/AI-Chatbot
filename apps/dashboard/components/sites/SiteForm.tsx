import type { FormEvent } from "react";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";
import { Select } from "../shared/Select";

type SiteFormValues = {
  siteKey: string;
  tenantId: string;
  name: string;
  domain: string;
  industry: string;
};

type SiteFormProps = {
  form: SiteFormValues;
  tenantOptions: Array<{ id: string; name: string }>;
  industryOptions: Array<{ value: string; label: string; description?: string }>;
  onChange: (next: SiteFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function SiteForm({ form, tenantOptions, industryOptions, onChange, onSubmit }: SiteFormProps) {
  return (
    <form onSubmit={onSubmit} className="dashboard-card dashboard-stack dashboard-stack--sm">
      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-name">
          Kundenname
        </label>
        <Input
          id="site-name"
          placeholder="Musterkunde GmbH"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-domain">
          Website oder Hauptdomain
        </label>
        <Input
          id="site-domain"
          placeholder="kunde.de"
          value={form.domain}
          onChange={(event) => onChange({ ...form, domain: event.target.value })}
        />
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-industry">
          Branche
        </label>
        <Select
          id="site-industry"
          value={form.industry}
          onChange={(event) => onChange({ ...form, industry: event.target.value })}
        >
          <option value="">Ohne Vorlage starten</option>
          {industryOptions.map((industry) => (
            <option key={industry.value} value={industry.value}>
              {industry.label}
            </option>
          ))}
        </Select>
        {form.industry ? (
          <div className="dashboard-copy dashboard-copy--muted" style={{ marginTop: 6 }}>
            {industryOptions.find((option) => option.value === form.industry)?.description || ""}
          </div>
        ) : null}
      </div>

      <details className="dashboard-card dashboard-card--soft">
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 600,
            listStyle: "none",
          }}
        >
          Erweiterte Angaben
        </summary>
        <div className="dashboard-stack dashboard-stack--sm" style={{ marginTop: 14 }}>
          <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
            Diese Angaben werden nur selten direkt benötigt und können später angepasst werden.
          </p>

          <div className="dashboard-field">
            <label className="dashboard-field-label" htmlFor="site-key">
              Einbindungscode
            </label>
            <Input
              id="site-key"
              placeholder="soule-smart-business"
              value={form.siteKey}
              onChange={(event) => onChange({ ...form, siteKey: event.target.value })}
            />
          </div>

          <div className="dashboard-field">
            <label className="dashboard-field-label" htmlFor="tenant-id">
              Mandant (intern)
            </label>
            <Select
              id="tenant-id"
              value={form.tenantId}
              onChange={(event) => onChange({ ...form, tenantId: event.target.value })}
              disabled={tenantOptions.length === 0}
            >
              {tenantOptions.length === 0 ? (
                <option value="">Keine Mandanten vorhanden</option>
              ) : null}
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </details>

      <Button type="submit">Kunde anlegen</Button>
    </form>
  );
}
