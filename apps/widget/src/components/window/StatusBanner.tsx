type StatusBannerProps = {
  error?: string | null;
  isSending: boolean;
};

export function StatusBanner({ error, isSending }: StatusBannerProps) {
  if (error) {
    return <div className="ssb-status-banner ssb-status-banner--error">{error}</div>;
  }

  if (isSending) {
    return (
      <div className="ssb-status-banner ssb-status-banner--loading">
        Antwort wird vorbereitet und gleich eingeblendet.
      </div>
    );
  }

  return null;
}
