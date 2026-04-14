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
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        overflow: "hidden",
        background: "#fff",
        minHeight: 280,
      }}
    >
      <div
        style={{
          background: props.brandColor,
          color: "#fff",
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {props.logoUrl ? (
          <img
            src={props.logoUrl}
            alt={props.companyName}
            style={{ width: 36, height: 36, borderRadius: 999, objectFit: "cover", background: "#fff" }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.18)",
              fontWeight: 700,
            }}
          >
            {props.companyName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 700 }}>{props.botName}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{props.companyName}</div>
        </div>
      </div>

      <div style={{ padding: 16, background: "#fafaf9" }}>
        <div
          style={{
            maxWidth: "80%",
            background: props.accentColor,
            borderRadius: 16,
            padding: "12px 14px",
            lineHeight: 1.5,
            color: "#111827",
          }}
        >
          {props.welcomeMessage}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 999,
              background: props.brandColor,
              boxShadow: "0 10px 25px rgba(0,0,0,0.14)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
