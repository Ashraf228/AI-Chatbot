import { Button } from "../shared/Button";

type ChatHeaderProps = {
  title: string;
  companyName?: string;
  botName?: string;
  logoUrl?: string;
  privacyUrl?: string;
  onClose: () => void;
};

export function ChatHeader({
  title,
  companyName,
  botName,
  logoUrl,
  privacyUrl,
  onClose,
}: ChatHeaderProps) {
  const displayTitle = companyName || title || "Chat";
  const assistantLabel = botName || "KI-Assistent";

  return (
    <div className="ssb-chat-header">
      <div className="ssb-chat-header__identity">
        <div className="ssb-chat-avatar" aria-hidden="true">
          {logoUrl ? <img src={logoUrl} alt="" /> : <span>{displayTitle.slice(0, 1)}</span>}
        </div>
        <div className="ssb-chat-header__copy">
          <div className="ssb-chat-title">{displayTitle}</div>
          <div className="ssb-chat-subtitle">
            <span className="ssb-chat-presence" aria-hidden="true" />
            {assistantLabel}
          </div>
          {privacyUrl ? (
            <a className="ssb-chat-privacy-link" href={privacyUrl} target="_blank" rel="noopener noreferrer">
              Datenschutz
            </a>
          ) : null}
        </div>
      </div>
      <Button type="button" variant="ghost" className="ssb-chat-close" onClick={onClose} aria-label="Chat schließen">
        ×
      </Button>
    </div>
  );
}
