import { Button } from "../shared/Button";

type SuggestedQuestionsProps = {
  questions: string[];
  disabled?: boolean;
  onSelect: (question: string) => void | Promise<void>;
};

export function SuggestedQuestions({
  questions,
  disabled,
  onSelect,
}: SuggestedQuestionsProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="ssb-suggested-questions">
      <div className="ssb-suggested-questions__label">Beliebte Fragen auf dieser Seite</div>
      <div className="ssb-suggested-questions__list">
        {questions.map((question) => (
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
