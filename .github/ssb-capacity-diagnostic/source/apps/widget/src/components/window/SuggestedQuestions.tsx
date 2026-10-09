import { Button } from "../shared/Button";

type SuggestedQuestionsProps = {
  questions: string[];
  disabled?: boolean;
  onSelect: (question: string) => void | Promise<void>;
};

const DEFAULT_QUESTIONS = [
  "Welche Leistungen bieten Sie an?",
  "Wie kann ich Kontakt aufnehmen?",
  "Ich brauche Unterstützung",
];

export function SuggestedQuestions({
  questions,
  disabled,
  onSelect,
}: SuggestedQuestionsProps) {
  const displayQuestions = questions.length > 0 ? questions.slice(0, 3) : DEFAULT_QUESTIONS;

  if (displayQuestions.length === 0) {
    return null;
  }

  return (
    <div className="ssb-suggested-questions">
      <div className="ssb-suggested-questions__label">Schnell starten</div>
      <div className="ssb-suggested-questions__list">
        {displayQuestions.map((question) => (
          <Button
            key={question}
            type="button"
            variant="secondary"
            className="ssb-suggested-question"
            disabled={disabled}
            onClick={() => void onSelect(question)}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
