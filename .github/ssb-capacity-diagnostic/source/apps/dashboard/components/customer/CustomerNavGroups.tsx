"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { findSiteWorkspaceLocation, resolveSiteNavHref, type SiteNavGroup } from "../../lib/dashboard-config";
import { encodeSiteId } from "../../lib/site-id";

export function CustomerNavGroups({
  siteId,
  groups,
}: {
  siteId: string;
  groups: SiteNavGroup[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siteSlug = encodeSiteId(siteId);
  const [hash, setHash] = useState("");
  const { activeGroup, activeItem } = findSiteWorkspaceLocation(
    groups,
    siteSlug,
    pathname,
    searchParams.toString(),
    hash,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <nav className="customer-nav-groups" aria-label="Kundenbereiche">
      {groups.map((group) => {
        const active = activeGroup?.id === group.id;
        const mainHref = resolveSiteNavHref(siteSlug, group);

        return (
          <section
            key={group.id}
            className={`customer-nav-group${active ? " customer-nav-group--active" : ""}`}
          >
            <div className="customer-nav-group__header">
              <Link href={mainHref} className="customer-nav-group__main" aria-current={active && !activeItem ? "page" : undefined}>
                {group.label}
              </Link>
              <p className="customer-nav-group__description">{group.description}</p>
            </div>
            {group.items.length ? (
              <div className="customer-nav-group__items">
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={resolveSiteNavHref(siteSlug, item)}
                    className={activeItem?.id === item.id ? "is-active" : ""}
                    aria-current={activeItem?.id === item.id ? "page" : undefined}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                    {item.badge ? <span className="customer-nav-group__badge">{item.badge}</span> : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}
