import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function Button(props: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button {...props} />;
}
