import Link from "next/link";

type EmptyStateCardProps = {
  title: string;
  description?: string;
  href?: string;
  actionLabel?: string;
};

export function EmptyStateCard({ title, description, href, actionLabel }: EmptyStateCardProps) {
  return (
    <div className="empty-state-card">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {href && actionLabel ? (
        <Link href={href} className="dashboard-button dashboard-button--secondary">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
