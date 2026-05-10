import { Button } from "../shared/Button";

type ConsentBannerProps = {
  visible: boolean;
  privacyUrl?: string;
  onAccept: () => void;
};

export function ConsentBanner({ visible, privacyUrl, onAccept }: ConsentBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="ssb-consent-banner">
      <div>
        Mit dem Start des Chats stimmst du der Verarbeitung deiner Angaben zu.
        {privacyUrl ? (
          <>
            {" "}
            <a href={privacyUrl} target="_blank" rel="noreferrer">
              Datenschutzhinweis öffnen
            </a>
          </>
        ) : null}
      </div>
      <Button type="button" onClick={onAccept}>
        Einverstanden
      </Button>
    </div>
  );
}
