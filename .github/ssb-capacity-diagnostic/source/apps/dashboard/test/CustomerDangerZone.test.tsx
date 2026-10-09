import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CustomerDangerZone } from "../components/customer/CustomerDangerZone";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("CustomerDangerZone", () => {
  beforeEach(() => {
    router.push.mockClear();
    router.refresh.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  test("requires exact löschen confirmation before deleting a customer", async () => {
    render(<CustomerDangerZone siteId="site-1" />);

    const deleteButton = screen.getByRole("button", { name: "Kunde endgültig löschen" });
    expect(deleteButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("löschen"), "LÖSCHEN");
    expect(deleteButton).toBeDisabled();

    await userEvent.clear(screen.getByPlaceholderText("löschen"));
    await userEvent.type(screen.getByPlaceholderText("löschen"), "löschen");
    expect(deleteButton).toBeEnabled();
  });

  test("deactivates only the widget through widget config", async () => {
    render(<CustomerDangerZone siteId="site-1" />);

    await userEvent.click(screen.getByRole("button", { name: "Widget deaktivieren" }));

    expect(fetch).toHaveBeenCalledWith("/api/widget/config/site-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
  });
});
