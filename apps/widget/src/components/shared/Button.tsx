import { forwardRef } from "react";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ children, className = "", variant = "primary", ...props }, ref) {
  return (
    <button
      {...props}
      ref={ref}
      className={`ssb-button ssb-button--${variant} ${className}`.trim()}
    >
      {children}
    </button>
  );
  },
);
