import { Input } from "../shared/Input";

type LogoUploadFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LogoUploadField({ value, onChange }: LogoUploadFieldProps) {
  return (
    <label className="dashboard-field">
      <span className="dashboard-field-label">Logo URL</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://kunde.de/logo.png"
      />
    </label>
  );
}
