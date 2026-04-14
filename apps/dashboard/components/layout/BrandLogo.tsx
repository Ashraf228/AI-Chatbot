import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  showWordmark?: boolean;
};

export function BrandLogo({ size = 52, showWordmark = true }: BrandLogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Image
        src="/soule-logo.png"
        alt="SSB Soule"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: 999,
          background: "#ffffff",
        }}
        priority
      />
      {showWordmark ? (
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.62)",
            }}
          >
            Managed Chat
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#f5f5f4",
            }}
          >
            Soulé
          </div>
        </div>
      ) : null}
    </div>
  );
}
