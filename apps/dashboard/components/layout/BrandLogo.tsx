import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  showWordmark?: boolean;
};

export function BrandLogo({ size = 52, showWordmark = true }: BrandLogoProps) {
  return (
    <div className="dashboard-brand">
      <Image
        src="/soule-logo.png"
        alt="SSB Soule"
        width={size}
        height={size}
        className="dashboard-brand-mark"
        style={{ width: size, height: size }}
        priority
      />
      {showWordmark ? (
        <div>
          <div className="dashboard-brand-overline dashboard-brand-overline--light">Managed Chat</div>
          <div className="dashboard-brand-name dashboard-brand-name--light">SSB</div>
        </div>
      ) : null}
    </div>
  );
}
