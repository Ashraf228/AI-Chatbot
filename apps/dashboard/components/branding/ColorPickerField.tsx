type ColorPickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10, flex: 1 }}
        />
      </div>
    </label>
  );
}
