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
        Mit dem Start des Chats stimmen Sie zu, dass Ihre Angaben und der Chatverlauf zur Bearbeitung Ihrer Anfrage gespeichert, verarbeitet und bei Bedarf an den Websitebetreiber weitergeleitet werden. Bitte geben Sie keine Passwörter, Zahlungsdaten oder Ausweisdaten ein.
        {privacyUrl ? (
          <>
            {" "}
            <a href={privacyUrl} target="_blank" rel="noreferrer">
              Datenschutzerklärung öffnen
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
