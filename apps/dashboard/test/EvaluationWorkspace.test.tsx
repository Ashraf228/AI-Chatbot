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
});
