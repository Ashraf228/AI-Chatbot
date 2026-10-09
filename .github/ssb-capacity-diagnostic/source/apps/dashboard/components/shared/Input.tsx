import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const classes = ["dashboard-control", className ?? ""].filter(Boolean).join(" ");
  return <input className={classes} {...props} />;
}
