type LeadFlowSettingsProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function LeadFlowSettings({ checked, onChange }: LeadFlowSettingsProps) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Lead-Capture im Widget anzeigen</span>
    </label>
  );
}
