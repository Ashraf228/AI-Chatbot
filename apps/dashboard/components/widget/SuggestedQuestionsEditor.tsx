type SuggestedQuestionsEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SuggestedQuestionsEditor({ value, onChange }: SuggestedQuestionsEditorProps) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>Fragen je Unterseite (JSON)</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        style={{
          padding: 10,
          border: "1px solid #d1d5db",
          borderRadius: 10,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      />
    </label>
  );
}
