import { Button } from "../shared/Button";
import { UnreadBadge } from "./UnreadBadge";

type ChatLauncherProps = {
  label: string;
  unreadCount: number;
  onClick: () => void;
};

export function ChatLauncher({ label, unreadCount, onClick }: ChatLauncherProps) {
  return (
    <div className="ssb-launcher">
      <Button type="button" variant="primary" onClick={onClick}>
        {label}
      </Button>
      <UnreadBadge count={unreadCount} />
    </div>
  );
}
