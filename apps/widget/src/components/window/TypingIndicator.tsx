import { Spinner } from "../shared/Spinner";

export function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="ssb-typing">
      <Spinner />
      <span>Antwort wird vorbereitet ...</span>
    </div>
  );
}
