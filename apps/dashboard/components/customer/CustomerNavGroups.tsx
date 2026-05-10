"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { encodeSiteId } from "../../lib/site-id";

type SiteNavItem = {
  slug: string;
  label: string;
};

type SiteNavGroup = {
  slug: string;
  label: string;
  items: SiteNavItem[];
};

function hrefFor(siteSlug: string, slug: string) {
  return slug ? `/sites/${siteSlug}/${slug}` : `/sites/${siteSlug}`;
}

function isGroupActive(pathname: string, siteSlug: string, group: SiteNavGroup) {
  return group.items.some((item) => pathname === hrefFor(siteSlug, item.slug));
}

export function CustomerNavGroups({
  siteId,
  groups,
}: {
  siteId: string;
  groups: SiteNavGroup[];
}) {
  const pathname = usePathname();
  const siteSlug = encodeSiteId(siteId);

  return (
    <nav className="customer-nav-groups" aria-label="Kundenbereiche">
      {groups.map((group) => {
        const active = isGroupActive(pathname, siteSlug, group);
        const mainHref = hrefFor(siteSlug, group.slug);

        return (
          <div
            key={group.label}
            className={`customer-nav-group${active ? " customer-nav-group--active" : ""}`}
          >
            <Link href={mainHref} className="customer-nav-group__main">
              {group.label}
            </Link>
            {group.items.length > 1 ? (
              <div className="customer-nav-group__items">
                {group.items.map((item) => (
                  <Link
                    key={item.slug || "overview"}
                    href={hrefFor(siteSlug, item.slug)}
                    className={pathname === hrefFor(siteSlug, item.slug) ? "is-active" : ""}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
