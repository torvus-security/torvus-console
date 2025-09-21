type ReadOnlyBannerProps = {
  message: string;
};

export function ReadOnlyBanner({ message }: ReadOnlyBannerProps) {
  return (
    <div className="read-only-banner" role="status" aria-live="polite" data-testid="read-only-banner">
      <span className="read-only-banner__label">Read-only mode</span>
      <span className="read-only-banner__message">{message}</span>
    </div>
  );
}
