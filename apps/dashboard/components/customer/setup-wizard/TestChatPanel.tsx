import { Button } from "../../shared/Button";
import { EmptyStateCard } from "../../shared/EmptyStateCard";
import { formatDate } from "./setupWizardFormatters";
import type { TestChatMessage } from "./setupWizardTypes";

type TestChatPanelProps = {
  messages: TestChatMessage[];
  input: string;
  lastTestedAt: string;
  isLoading: boolean;
  onChangeInput: (value: string) => void;
  onSend: () => void;
};

const PRESET_QUESTIONS = ["Was kostet eine Rohrreinigung?", "Meine Toilette ist verstopft", "Ich möchte zurückgerufen werden"];
const REDACTED_VALUES = new Set(["[DATEN BEREINIGT]", "[TESTDATEN BEREINIGT]", "[REDACTED]", "null", "undefined"]);

function safeMessageText(value: string) {
  return REDACTED_VALUES.has(value.trim()) ? "Diese Antwort wurde bereinigt." : value;
}

export function TestChatPanel({ messages, input, lastTestedAt, isLoading, onChangeInput, onSend }: TestChatPanelProps) {
  return (
    <div className="setup-module-card launch-step__panel launch-step__test-chat dashboard-stack dashboard-stack--sm" id="customer-test-chat">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Interner Testbereich</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Teste den Assistenten nur intern. Kein Public Widget, kein Deploy und keine echten Tickets, E-Mails oder Webhooks.
        </p>
      </div>

      <div className="dashboard-inline dashboard-wrap">
        {PRESET_QUESTIONS.map((question) => (
          <Button key={question} type="button" variant="secondary" onClick={() => onChangeInput(question)}>
            {question}
          </Button>
        ))}
      </div>

      <div className="launch-step__messages dashboard-stack dashboard-stack--sm">
        {messages.length === 0 ? (
          <EmptyStateCard title="Noch kein Testgespräch" description="Stelle eine Testfrage, um zu prüfen, wie der Assistent antwortet." />
        ) : (
          messages.map((entry, index) => (
            <div key={`${entry.role}-${index}`} className="dashboard-card dashboard-card--compact launch-step__message">
              <strong>{entry.role === "user" ? "Testfrage" : "Antwort des Assistenten"}</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">{safeMessageText(entry.text)}</p>
              {entry.sources?.length ? (
                <p className="dashboard-copy dashboard-copy--muted dashboard-mt-4 dashboard-no-margin-bottom">
                  Genutzte Wissensbasis: {entry.sources.map((source) => source.title || source.url || "Eintrag").join(", ")}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>

      <label className="dashboard-field">
        <span className="dashboard-field-label">Interne Testfrage</span>
        <textarea
          className="dashboard-textarea wizard-textarea-compact"
          rows={2}
          value={input}
          onChange={(event) => onChangeInput(event.target.value)}
          placeholder="Testfrage eingeben"
        />
      </label>
      <Button type="button" onClick={onSend} disabled={isLoading}>
        {isLoading ? "Test läuft..." : "Interne Testfrage senden"}
      </Button>
      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">Letzter Test: {formatDate(lastTestedAt)}</p>
    </div>
  );
}
