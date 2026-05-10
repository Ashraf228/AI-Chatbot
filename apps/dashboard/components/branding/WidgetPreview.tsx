import { resolveBrandingFontStack } from "../../lib/branding-fonts";

type WidgetPreviewProps = {
  companyName: string;
  botName: string;
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  fontFamily: string;
  welcomeMessage: string;
  placeholderText?: string;
  launcherLabel?: string;
  privacyUrl?: string;
};

export function WidgetPreview(props: WidgetPreviewProps) {
  const displayTitle = props.companyName || "Support";
  const displayBotName = props.botName || "Service-Assistent";
  const displayPlaceholder = props.placeholderText || "Nachricht schreiben...";
  const launcherLabel = props.launcherLabel || "Chat";

  return (
    <div
      className="dashboard-preview-card"
      style={{ fontFamily: resolveBrandingFontStack(props.fontFamily) }}
    >
      <div className="dashboard-preview-header">
        <div className="dashboard-preview-identity">
          {props.logoUrl ? (
            <img src={props.logoUrl} alt={props.companyName} className="dashboard-preview-logo" />
          ) : (
            <div
              className="dashboard-preview-fallback"
              style={{
                color: props.brandColor,
                borderColor: `${props.brandColor}33`,
                background: `${props.brandColor}14`,
              }}
            >
              {displayBotName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="dashboard-preview-copy">
            <div className="dashboard-preview-title">{displayTitle}</div>
            <div className="dashboard-preview-subtitle">
              <span className="dashboard-preview-presence" aria-hidden="true" />
              {displayBotName}
            </div>
            {props.privacyUrl ? <div className="dashboard-preview-privacy">Datenschutz</div> : null}
          </div>
        </div>
        <div className="dashboard-preview-close">×</div>
      </div>

      <div className="dashboard-preview-body">
        <div className="dashboard-preview-bubble-row">
          <div
            className="dashboard-preview-bubble"
            style={{ background: props.accentColor, borderColor: `${props.brandColor}24` }}
          >
            {props.welcomeMessage || "Hi! Wie kann ich helfen?"}
          </div>
        </div>

        <div className="dashboard-preview-chip-row">
          <span>Welche Leistungen bieten Sie an?</span>
          <span>Kontakt aufnehmen</span>
          <span>Ich brauche Unterstützung</span>
        </div>

        <p className="dashboard-preview-hint">
          Die KI kann Fehler machen. Bei Bedarf wird deine Anfrage weitergeleitet.
        </p>

        <div className="dashboard-preview-composer">
          <div className="dashboard-preview-input">{displayPlaceholder}</div>
          <div className="dashboard-preview-send" style={{ background: props.brandColor }}>
            Senden
          </div>
        </div>

        <div className="dashboard-preview-launcher-row">
          <div className="dashboard-preview-launcher" style={{ background: props.brandColor }}>
            <span className="dashboard-preview-launcher-icon" />
            {launcherLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
