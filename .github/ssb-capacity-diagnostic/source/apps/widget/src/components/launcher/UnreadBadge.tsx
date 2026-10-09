export function UnreadBadge({ count }: { count: number }) {
  if (count < 1) {
    return null;
  }

  return <span className="ssb-unread-badge">{count}</span>;
}
