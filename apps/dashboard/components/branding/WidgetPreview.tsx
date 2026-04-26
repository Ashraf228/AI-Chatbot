import { resolveBrandingFontStack } from "../../lib/branding-fonts";

type WidgetPreviewProps = {
  companyName: string;
  botName: string;
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  fontFamily: string;
  welcomeMessage: string;
};

export function WidgetPreview(props: WidgetPreviewProps) {
  const displayTitle = props.companyName || "Support";
  const displayBotName = props.botName || "Service-Assistent";

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
              {displayBotName} • {displayTitle}
            </div>
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

        <div className="dashboard-preview-composer">
          <div className="dashboard-preview-input">Nachricht schreiben...</div>
          <div className="dashboard-preview-send" style={{ background: props.brandColor }}>
            Senden
          </div>
        </div>

        <div className="dashboard-preview-launcher-row">
          <div className="dashboard-preview-launcher" style={{ background: props.brandColor }}>
            Chat
          </div>
        </div>
      </div>
    </div>
  );
}
