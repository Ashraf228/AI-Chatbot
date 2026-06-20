import React from "react";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string | { pathname?: string };
};

export default function Link({ children, href, ...props }: LinkProps) {
  const resolvedHref = typeof href === "string" ? href : href.pathname ?? "#";

  return React.createElement("a", { href: resolvedHref, ...props }, children);
}
