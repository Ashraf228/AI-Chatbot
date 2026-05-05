import type { FormEvent } from "react";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";
import { Select } from "../shared/Select";

type SiteFormValues = {
  siteKey: string;
  tenantId: string;
  name: string;
  domain: string;
};

type SiteFormProps = {
  form: SiteFormValues;
  tenantOptions: Array<{ id: string; name: string }>;
  onChange: (next: SiteFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function SiteForm({ form, tenantOptions, onChange, onSubmit }: SiteFormProps) {
  return (
    <form onSubmit={onSubmit} className="dashboard-card dashboard-stack dashboard-stack--sm">
      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-key">
          Kundenschlüssel
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
          Mandant
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
              {tenant.name} ({tenant.id})
            </option>
          ))}
        </Select>
      </div>

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
          Domain
        </label>
        <Input
          id="site-domain"
          placeholder="kunde.de"
          value={form.domain}
          onChange={(event) => onChange({ ...form, domain: event.target.value })}
        />
      </div>

      <Button type="submit">Kunde anlegen</Button>
    </form>
  );
}
