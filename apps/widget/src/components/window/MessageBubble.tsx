import type { ChatMessage } from "../../types/chat";

type MessageBubbleProps = {
  message: ChatMessage;
  showLeadLink?: boolean;
  onLeadLinkClick?: () => void | Promise<void>;
};

export function MessageBubble({
  message,
  showLeadLink = false,
  onLeadLinkClick,
}: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  if (message.pending && !message.content.trim()) {
    return null;
  }

  return (
    <div className={`ssb-message ssb-message--${message.role}`}>
      <div className="ssb-message-bubble">{message.content}</div>
      {isAssistant && showLeadLink ? (
        <div className="ssb-message-cta">
          <button
            type="button"
            className="ssb-lead-prompt__link"
            onClick={() => void onLeadLinkClick?.()}
          >
            Kontaktdaten hier hinterlassen
          </button>
        </div>
      ) : null}
      {isAssistant && Array.isArray(message.sources) && message.sources.length > 0 ? (
        <div className="ssb-message-sources">
          Quellen:{" "}
          {message.sources.slice(0, 3).map((source, index) => {
            const label = source.url ? source.title || source.url : source.title || "Quelle";

            return (
              <span key={`${label}-${index}`}>
                {index > 0 ? " · " : ""}
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {label}
                  </a>
                ) : (
                  label
                )}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
