import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import LoginPage from "../app/login/page";
import { EvaluationWorkspace } from "../app/evaluation/EvaluationWorkspace";
import { expectNoCriticalOrSeriousAxeViolations } from "../../../test/ui/accessibility";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const context = {
  workspaceTitle: "NOLIS Evaluationsdemonstrator",
  siteDisplayName: "Synthetische Demo",
  disclaimer: "Kooperationsdemonstrator mit synthetischen Inhalten.",
  accountExpiresAt: "2099-01-01T00:00:00.000Z",
  scenarios: [
    { key: "support", title: "Supportfall vorbereiten", prompt: "Ich brauche Hilfe", demo: true },
  ],
  technicalFeatures: ["Mandanten- und Site-Trennung", "Signierter Demo-Handoff"],
};

describe("Dashboard accessibility baseline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("login has labels, safe error state, and no critical or serious axe violations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Login fehlgeschlagen" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<LoginPage />);

    expect(screen.getByRole("heading", { level: 1, name: /Willkommen zurück/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Passwort")).toHaveAttribute("autocomplete", "current-password");

    await userEvent.click(screen.getByRole("button", { name: "Admin-Login" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Login fehlgeschlagen"));
    expect(screen.getByLabelText("Passwort")).toHaveAttribute("aria-invalid", "true");
    await expectNoCriticalOrSeriousAxeViolations(container);
  });

  test("evaluation scenario is keyboard-usable, copies text only, and moves focus to input", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<EvaluationWorkspace context={context} />);

    const scenario = screen.getByRole("button", { name: /Supportfall vorbereiten/i });
    scenario.focus();
    await userEvent.keyboard("{Enter}");

    const input = screen.getByLabelText("Testfrage");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Ich brauche Hilfe");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Beispieltext übernommen/i)).toBeInTheDocument();
    await expectNoCriticalOrSeriousAxeViolations(container);
  });

  test("evaluation announces finished answer, ticket preview, ticket success, and handoff status once per state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversationId: "evaluation-session-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: "Die synthetische Antwort ist fertig.",
          sources: [{ title: "Synthetische Quelle", sourceType: "faq", publicUrl: "https://example.com", demo: true }],
          ticketPreview: {
            status: "ready",
            previewToken: "preview-token",
            missingFields: [],
            demo: true,
            synthetic: true,
            fields: {
              product: "Demonstrator",
              description: "Synthetischer Fehler",
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          note: "Der Demo-Supportfall wurde im Demonstrator erfasst. Es erfolgte keine externe Übermittlung.",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "mock_delivered",
          demoReference: "DEMO-12345678",
          attemptCount: 1,
          signatureVerified: true,
          duplicateRecognized: false,
          message: "Die signierte Demo-Übergabe wurde bestätigt.",
          externalNotice: "Es erfolgte keine Übermittlung an ein externes Ticketsystem.",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<EvaluationWorkspace context={context} />);

    await userEvent.type(screen.getByLabelText("Testfrage"), "Bitte prüfen");
    await userEvent.click(screen.getByRole("button", { name: "Senden" }));

    await waitFor(() => {
      expect(screen.getByText("Demo-Supportfall Vorschau").closest("[tabindex='-1']")).toHaveFocus();
    });
    expect(screen.getByText(/Antwort des Assistenten: Die synthetische Antwort ist fertig/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Synthetische Quelle" })).toHaveAttribute("rel", expect.stringContaining("noopener"));

    await userEvent.click(screen.getByRole("button", { name: "Demo-Ticket erstellen" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/keine externe Übermittlung/i));

    await userEvent.click(screen.getByRole("button", { name: "Signierte Demo-Übergabe simulieren" }));
    await waitFor(() => expect(screen.getAllByText("Die signierte Demo-Übergabe wurde bestätigt.").length).toBeGreaterThan(0));

    expect(screen.queryByText(/x-ssb-signature|evt_|del_/i)).not.toBeInTheDocument();
    await expectNoCriticalOrSeriousAxeViolations(container);
  });

  test("evaluation session expiry shows programmatic error and clears local dialog state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversationId: "evaluation-session-1" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetchMock);
    render(<EvaluationWorkspace context={context} />);

    await userEvent.type(screen.getByLabelText("Testfrage"), "Bitte prüfen");
    await userEvent.click(screen.getByRole("button", { name: "Senden" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Evaluationssitzung ist nicht mehr gueltig/i);
    });
    expect(screen.getByText("Noch keine Daten. Starten Sie einen neuen Testdialog.")).toBeInTheDocument();
  });
});
