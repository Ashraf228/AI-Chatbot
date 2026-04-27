import type { FormEvent } from "react";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";

type SiteFormValues = {
  siteKey: string;
  tenantId: string;
  name: string;
  domain: string;
};

type SiteFormProps = {
  form: SiteFormValues;
  onChange: (next: SiteFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function SiteForm({ form, onChange, onSubmit }: SiteFormProps) {
  return (
    <form onSubmit={onSubmit} className="dashboard-card dashboard-stack dashboard-stack--sm">
      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-key">
          Site Key
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
          Tenant-ID
        </label>
        <Input
          id="tenant-id"
          placeholder="t_default"
          value={form.tenantId}
          onChange={(event) => onChange({ ...form, tenantId: event.target.value })}
        />
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-name">
          Anzeigename
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

      <Button type="submit">Site erstellen</Button>
    </form>
  );
}
