import type { ChatMessage } from "../../types/chat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`ssb-message ssb-message--${message.role}`}>
      <div className="ssb-message-bubble">{message.content}</div>
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
