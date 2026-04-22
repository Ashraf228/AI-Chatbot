type SuggestedQuestionsEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SuggestedQuestionsEditor({ value, onChange }: SuggestedQuestionsEditorProps) {
  return (
    <label className="dashboard-field">
      <span className="dashboard-field-label">Fragen je Unterseite (JSON)</span>
      <textarea
        className="dashboard-textarea dashboard-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
      />
    </label>
  );
}
