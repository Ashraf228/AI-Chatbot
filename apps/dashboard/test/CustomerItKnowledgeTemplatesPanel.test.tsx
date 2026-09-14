import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CustomerItKnowledgeTemplatesPanel } from "../components/knowledge/CustomerItKnowledgeTemplatesPanel";

function catalog(importedSourceId: string | null = null) {
  return {
    siteId: "site-1",
    templates: [{
      key: "vpn-not-connecting",
      title: "VPN verbindet nicht",
      category: "connectivity",
      issueType: "vpn",
      tags: ["vpn", "netzwerk"],
      importedSourceId,
    }],
    providerCallsUsed: false,
    answerReadyTransitionAdded: false,
  };
}

describe("CustomerItKnowledgeTemplatesPanel", () => {
  test("shows an explicit read-only state when the persisted capability is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ message: "Forbidden" }, { status: 403 }),
    ));

    render(<CustomerItKnowledgeTemplatesPanel siteId="site-1" />);

    expect(await screen.findByText("Wissensverwaltung nicht zugewiesen")).toBeInTheDocument();
    expect(screen.getByText(/nur intern vergeben/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /übernehmen/ })).not.toBeInTheDocument();
  });

  test("imports a selected template as a provider-free draft and reloads its status", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(catalog()))
      .mockResolvedValueOnce(Response.json({
        siteId: "site-1",
        mode: "skip_existing",
        imported: [{ templateKey: "vpn-not-connecting", sourceId: "source-1", status: "imported" }],
        skipped: [],
        overwritten: [],
        providerCallsUsed: false,
        answerReadyTransitionAdded: false,
      }, { status: 201 }))
      .mockResolvedValueOnce(Response.json(catalog("source-1")));
    vi.stubGlobal("fetch", fetchMock);
    const onChanged = vi.fn();
    const user = userEvent.setup();

    render(<CustomerItKnowledgeTemplatesPanel siteId="site-1" onChanged={onChanged} />);
    expect(await screen.findByText("VPN verbindet nicht")).toBeInTheDocument();
    expect(screen.getByText(/keine Provider aufgerufen/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "VPN verbindet nicht auswählen" }));
    await user.click(screen.getByRole("button", { name: "1 Vorlage übernehmen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/sites/site-1/it-knowledge/templates/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ templateKeys: ["vpn-not-connecting"], mode: "skip_existing" }),
      }),
    ));
    expect(await screen.findByText("Entwurf vorhanden")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
