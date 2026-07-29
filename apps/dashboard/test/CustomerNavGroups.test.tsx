import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { CustomerNavGroups } from "../components/customer/CustomerNavGroups";
import { siteNavGroups } from "../lib/dashboard-config";

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

describe("CustomerNavGroups", () => {
  test("groups the workspace into clear main areas and marks the review focus as active", async () => {
    window.history.replaceState({}, "", "/sites/site-1/setup?step=launch#setup-step-live");

    render(<CustomerNavGroups siteId="site-1" groups={siteNavGroups} />);

    expect(screen.getByRole("link", { name: "Einrichtung" })).toBeInTheDocument();
    expect(screen.getByText(/Source of truth für Setup, Review, internen Test/i)).toBeInTheDocument();
    expect(screen.getByText("Interner Test")).toBeInTheDocument();
    expect(screen.getByText("Intern")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review & Livegang/i })).toHaveAttribute("aria-current", "page");
  });

  test("uses the customer-test hash as the active internal-test focus", async () => {
    window.history.replaceState({}, "", "/sites/site-1/setup?step=launch#customer-test-chat");

    render(<CustomerNavGroups siteId="site-1" groups={siteNavGroups} />);

    expect(screen.getByRole("link", { name: /Interner Test/i })).toHaveAttribute("aria-current", "page");
  });
});
