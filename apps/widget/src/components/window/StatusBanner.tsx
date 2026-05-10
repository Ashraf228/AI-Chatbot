type StatusBannerProps = {
  error?: string | null;
  isSending: boolean;
};

export function StatusBanner({ error, isSending }: StatusBannerProps) {
  if (error) {
    return (
      <div className="ssb-status-banner ssb-status-banner--error" role="status">
        {error}
      </div>
    );
  }

  if (isSending) {
    return null;
  }

  return null;
}
