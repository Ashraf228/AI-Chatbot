import { Button } from "../shared/Button";

type ChatHeaderProps = {
  title: string;
  companyName?: string;
  botName?: string;
  logoUrl?: string;
  onClose: () => void;
};

export function ChatHeader({ title, companyName, botName, logoUrl, onClose }: ChatHeaderProps) {
  return (
    <div className="ssb-chat-header">
      <div className="ssb-chat-header__identity">
        <div className="ssb-chat-avatar" aria-hidden="true">
          {logoUrl ? <img src={logoUrl} alt="" /> : <span>{(botName || title).slice(0, 1)}</span>}
        </div>
        <div className="ssb-chat-title">{title}</div>
        <div className="ssb-chat-subtitle">
          {(botName || "Service-Assistent") + " • " + (companyName || "KI-gestuetzter Support")}
        </div>
      </div>
      <Button type="button" variant="ghost" onClick={onClose} aria-label="Chat schliessen">
        ×
      </Button>
    </div>
  );
}
