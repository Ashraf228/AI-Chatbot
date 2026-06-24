import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { EvaluationWorkspace } from "../app/evaluation/EvaluationWorkspace";

const context = {
  workspaceTitle: "Demo Evaluation",
  siteDisplayName: "Demo Site",
  disclaimer:
    "Kooperationsdemonstrator mit synthetischen Inhalten. Keine Verbindung zu Produktivsystemen oder externen Fachverfahren.",
  accountExpiresAt: "2099-01-01T00:00:00.000Z",
  scenarios: [
    { key: "one", title: "Quellenbasierte Soforthilfe", prompt: "Frage eins", demo: true },
    { key: "two", title: "Strukturierte Übergabe", prompt: "Frage zwei", demo: true },
    { key: "three", title: "Sichere Nicht-Antwort bei fehlendem Wissen", prompt: "Frage drei", demo: true },
  ],
  technicalFeatures: ["Mandanten- und Site-Trennung", "Keine Verwaltungsentscheidung durch die KI"],
};

describe("EvaluationWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders read-only demo workspace without dashboard navigation or mutation controls", () => {
    render(<EvaluationWorkspace context={context} />);

    expect(screen.getByText("Kooperationsdemonstrator")).toBeInTheDocument();
    expect(screen.getByText("Nur-Lesezugang")).toBeInTheDocument();
    expect(screen.getByText("Quellenbasierte Soforthilfe")).toBeInTheDocument();
    expect(screen.getByText("Strukturierte Übergabe")).toBeInTheDocument();
    expect(screen.getByText("Sichere Nicht-Antwort bei fehlendem Wissen")).toBeInTheDocument();
    expect(screen.queryByText("Einstellungen")).not.toBeInTheDocument();
    expect(screen.queryByText("Importieren")).not.toBeInTheDocument();
    expect(screen.queryByText("Löschen")).not.toBeInTheDocument();
    expect(screen.getByText("Noch keine Daten. Starten Sie einen neuen Testdialog.")).toBeInTheDocument();
    expect(screen.getByText(/Bitte geben Sie keine Passwörter, MFA-Codes, API-Schlüssel/i)).toBeInTheDocument();
  });

  test("scenario card only copies prompt and does not send automatically", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<EvaluationWorkspace context={context} />);

    await userEvent.click(screen.getByRole("button", { name: /Quellenbasierte Soforthilfe/i }));

    expect(screen.getByPlaceholderText("Testfrage eingeben...")).toHaveValue("Frage eins");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("shows retry action for temporary chat errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversationId: "evaluation-session-1" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);
    render(<EvaluationWorkspace context={context} />);

    await userEvent.type(screen.getByPlaceholderText("Testfrage eingeben..."), "Testfrage");
    await userEvent.click(screen.getByRole("button", { name: "Senden" }));

    await waitFor(() => {
      expect(screen.getByText("Die Nachricht konnte nicht verarbeitet werden.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();
  });

  test("renders product support preview and confirms demo ticket without external wording", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversationId: "evaluation-session-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: "Ich habe eine Vorschau vorbereitet.",
          sources: [],
          ticketPreview: {
            status: "ready",
            previewToken: "preview-token",
            missingFields: [],
            demo: true,
            synthetic: true,
            fields: {
              supportProfile: "product",
              product: "Kooperationsdemonstrator",
              module: "Formularverwaltung",
              customerOrganization: "Beispielkommune - Demonstrator",
              description: "Formular Upload blockiert.",
              impact: "high",
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "created",
          demoReference: "DEMO-12345678",
          forwardingStatus: "not_configured",
          note: "Der Demo-Supportfall wurde im Demonstrator erfasst. Es erfolgte keine Übermittlung an ein externes Ticketsystem.",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<EvaluationWorkspace context={context} />);

    await userEvent.type(screen.getByPlaceholderText("Testfrage eingeben..."), "Bitte Ticket melden");
    await userEvent.click(screen.getByRole("button", { name: "Senden" }));

    await waitFor(() => {
      expect(screen.getByText("Demo-Supportfall Vorschau")).toBeInTheDocument();
    });
    expect(screen.queryByText(/viewer@example/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Demo-Ticket erstellen" }));

    await waitFor(() => {
      expect(screen.getAllByText(/keine Übermittlung an ein externes Ticketsystem/i).length).toBeGreaterThan(0);
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/evaluation/chat/ticket/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ conversationId: "evaluation-session-1", previewToken: "preview-token" }),
      }),
    );
  });
});
