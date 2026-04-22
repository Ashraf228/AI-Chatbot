type WidgetPreviewProps = {
  companyName: string;
  botName: string;
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  welcomeMessage: string;
};

export function WidgetPreview(props: WidgetPreviewProps) {
  return (
    <div className="dashboard-preview-card">
      <div className="dashboard-preview-header" style={{ background: props.brandColor }}>
        {props.logoUrl ? (
          <img src={props.logoUrl} alt={props.companyName} className="dashboard-preview-logo" />
        ) : (
          <div className="dashboard-preview-fallback">
            {props.companyName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 700 }}>{props.botName}</div>
          <div className="dashboard-meta">{props.companyName}</div>
        </div>
      </div>

      <div className="dashboard-preview-body">
        <div className="dashboard-preview-bubble" style={{ background: props.accentColor }}>
          {props.welcomeMessage}
        </div>

        <div className="dashboard-preview-launcher-row">
          <div className="dashboard-preview-launcher" style={{ background: props.brandColor }} />
        </div>
      </div>
    </div>
  );
}
