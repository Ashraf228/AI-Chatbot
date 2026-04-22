import { Input } from "../shared/Input";

type ColorPickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  return (
    <label className="dashboard-field">
      <span className="dashboard-field-label">{label}</span>
      <div className="dashboard-inline">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
    </label>
  );
}
