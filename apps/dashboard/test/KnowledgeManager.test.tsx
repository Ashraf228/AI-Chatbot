import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { KnowledgeManager } from "../components/knowledge/KnowledgeManager";
import { KnowledgeWorkspace } from "../components/knowledge/KnowledgeWorkspace";

describe("KnowledgeManager", () => {
  test("loads saved FAQ/PDF entries and updates an FAQ answer", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "faq-doc-1",
            type: "faq",
            title: "FAQ",
            sourceUrl: "",
            createdAt: "2026-04-28T10:00:00.000Z",
            chunkCount: 1,
            faqItems: [
              {
                id: "faq-1",
                question: "Was macht ihr?",
                answer: "Alles rund um KI",
              },
            ],
          },
          {
            id: "pdf-doc-1",
            type: "pdf",
            title: "vertrieb.pdf",
            sourceUrl: "",
            createdAt: "2026-04-28T10:00:00.000Z",
            chunkCount: 3,
            faqItems: [],
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<KnowledgeManager siteId="Kunde 1" />);

    expect(await screen.findByText("vertrieb.pdf")).toBeInTheDocument();
    expect(await screen.findByText("Was macht ihr?")).toBeInTheDocument();
    expect(screen.getByText("Alles rund um KI")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Bearbeiten" }));

    const answerInput = screen.getByPlaceholderText("Antwort");
    await user.clear(answerInput);
    await user.type(answerInput, "KI, Automatisierung und smarte Prozesse.");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/knowledge/faq/faq-1",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "Kunde 1",
            q: "Was macht ihr?",
            a: "KI, Automatisierung und smarte Prozesse.",
          }),
        }),
      ),
    );

    expect(
      await screen.findByText("KI, Automatisierung und smarte Prozesse."),
    ).toBeInTheDocument();
  });

  test("keeps existing knowledge read-only for customer sessions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{
        id: "faq-doc-1",
        type: "faq",
        title: "FAQ",
        sourceUrl: "",
        createdAt: "2026-04-28T10:00:00.000Z",
        chunkCount: 1,
        faqItems: [{ id: "faq-1", question: "Frage", answer: "Antwort" }],
      }]), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<KnowledgeManager siteId="site-1" readOnly />);

    expect(await screen.findByText("Frage")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bearbeiten" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Löschen" })).not.toBeInTheDocument();
  });

  test("keeps viewers read-only and hides all knowledge import controls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json([{
        id: "faq-doc-1",
        type: "faq",
        title: "FAQ",
        sourceUrl: "",
        createdAt: "2026-04-28T10:00:00.000Z",
        chunkCount: 1,
        faqItems: [{ id: "faq-1", question: "Viewer-Frage", answer: "Viewer-Antwort" }],
      }]),
    ));

    render(<KnowledgeWorkspace siteId="site-1" role="viewer" />);

    expect(await screen.findByText("Viewer-Frage")).toBeInTheDocument();
    expect(screen.queryByText("Wissen hinzufügen")).not.toBeInTheDocument();
    expect(screen.queryByText("Freigegebene Wissensvorlagen")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bearbeiten" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Löschen" })).not.toBeInTheDocument();
  });
});
