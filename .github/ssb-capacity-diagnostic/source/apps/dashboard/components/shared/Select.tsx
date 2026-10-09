import type { SelectHTMLAttributes } from "react";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const classes = ["dashboard-select", className ?? ""].filter(Boolean).join(" ");
  return <select className={classes} {...props} />;
}
