export function ErrorState({ message }: { message: string }) {
  return <div className="dashboard-error">{message}</div>;
}
