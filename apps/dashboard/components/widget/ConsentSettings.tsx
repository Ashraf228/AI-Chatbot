type ConsentSettingsProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function ConsentSettings({ checked, onChange }: ConsentSettingsProps) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>DSGVO-Hinweis und Consent aktivieren</span>
    </label>
  );
}
