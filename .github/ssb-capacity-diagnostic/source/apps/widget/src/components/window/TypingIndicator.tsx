import { Spinner } from "../shared/Spinner";

export function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="ssb-typing" role="status" aria-live="polite">
      <Spinner />
      <span>Der Assistent schreibt...</span>
    </div>
  );
}
