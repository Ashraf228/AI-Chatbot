import { forwardRef } from "react";
import { Button } from "../shared/Button";
import { UnreadBadge } from "./UnreadBadge";

type ChatLauncherProps = {
  label: string;
  unreadCount: number;
  expanded?: boolean;
  controlsId?: string;
  onClick: () => void;
};

export const ChatLauncher = forwardRef<HTMLButtonElement, ChatLauncherProps>(
  function ChatLauncher({ label, unreadCount, expanded = false, controlsId, onClick }, ref) {
  const displayLabel = label?.trim() || "Chat";

  return (
    <div className="ssb-launcher">
      <Button
        ref={ref}
        type="button"
        variant="primary"
        className="ssb-launcher__button"
        aria-label={`${displayLabel} öffnen`}
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={onClick}
      >
        <span className="ssb-launcher__icon" aria-hidden="true">
          <span />
        </span>
        <span className="ssb-launcher__label">{displayLabel}</span>
      </Button>
      <UnreadBadge count={unreadCount} />
    </div>
  );
  },
);
