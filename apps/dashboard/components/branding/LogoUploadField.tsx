type LogoUploadFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LogoUploadField({ value, onChange }: LogoUploadFieldProps) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>Logo URL</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://kunde.de/logo.png"
        style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
      />
    </label>
  );
}
