import { Button } from "../shared/Button";

type ConsentBannerProps = {
  visible: boolean;
  onAccept: () => void;
};

export function ConsentBanner({ visible, onAccept }: ConsentBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="ssb-consent-banner">
      <div>
        Mit dem Start des Chats stimmst du der Verarbeitung deiner Angaben gemaess
        Datenschutzhinweis zu.
      </div>
      <Button type="button" onClick={onAccept}>
        Einverstanden
      </Button>
    </div>
  );
}
