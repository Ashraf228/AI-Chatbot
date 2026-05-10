import { Button } from "./Button";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="dashboard-error" role="alert">
      <span>{message || "Es ist ein Fehler aufgetreten."}</span>
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry}>
          Erneut versuchen
        </Button>
      ) : null}
    </div>
  );
}
