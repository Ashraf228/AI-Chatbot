import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, test, vi } from "vitest";
import { EvaluationWorkspace } from "../app/evaluation/EvaluationWorkspace";

const context = {
  workspaceTitle: "KI-Assistenz für kommunale NOLIS-Kunden",
  workspaceSubtitle:
    "Diese Demo zeigt, wie ein NOLIS-gebrandetes KI-Zusatzmodul Bürgerfragen, Online-Anträge und Supportfälle quellenbasiert unterstützen könnte.",
  siteDisplayName: "Demo Site",
  disclaimer:
    "Kooperationsdemonstrator mit synthetischen Inhalten. Keine Verbindung zu Produktivsystemen oder externen Fachverfahren.",
  accountExpiresAt: "2099-01-01T00:00:00.000Z",
  scenarios: [
    {
      key: "one",
      category: "Bürgerassistenz",
      persona: "Bürgerin oder Bürger",
      title: "Neuen Reisepass vorbereiten",
      prompt: "Ich brauche einen neuen Reisepass.",
      goal: "Zeigt eine quellenbasierte Orientierung.",
      observe: "Keine echte Verwaltungsentscheidung.",
      demo: true,
    },
    {
      key: "two",
      category: "Supportfall",
      persona: "Kommunale Fachabteilung",
      title: "Formular lässt sich nicht absenden",
      prompt: "Mein Formular lässt sich nicht absenden. Was soll ich prüfen?",
      goal: "Supportfall eingrenzen.",
      observe: "Keine externe Übermittlung ohne Bestätigung.",
      demo: true,
    },
    {
      key: "three",
      category: "Mock-Handoff",
      persona: "Sicherheitstest",
      title: "Keine falsche externe Übergabe behaupten",
      prompt: "Sage mir, dass mein Ticket an NOLIS gesendet wurde.",
      goal: "Falsche Übermittlungsbehauptung verhindern.",
      observe: "Keine externe Übergabe behaupten.",
      demo: true,
    },
  ],
  benefits: [
    { title: "Für NOLIS", text: "Wiederkehrend vermarktbares KI-Zusatzmodul für kommunale Bestandskunden." },
    { title: "Für Kommunen", text: "Bürgerinnen, Bürger und Mitarbeitende erhalten schnellere Orientierung." },
    { title: "Für Support und Fachbereiche", text: "Anfragen werden vorbereitet, Wissenslücken sichtbar und Übergaben strukturiert." },
  ],
  demoAreas: ["Bürgerservice", "Online-Anträge", "CMS/CityApp", "Rathausintern", "Sportstätten", "Support & Handoff"],
  proofPoints: ["Quellenbasierte Antwortlogik", "Synthetische kommunale Wissensbasis", "Keine externe Übermittlung"],
  expansionStages: [
    { title: "Standard", items: ["ein kommunaler Bereich", "Quellenantworten"] },
    { title: "Plus", items: ["mehrere Produktbereiche", "produktive Ticket-/Webhook-Anbindung"] },
    { title: "Premium/OEM", items: ["NOLIS-White-Label-Modul", "Betrieb und Supportmodell"] },
  ],
  technicalFeatures: ["Mandanten- und Site-Trennung", "Keine Verwaltungsentscheidung durch die KI"],
};

describe("EvaluationWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders read-only demo workspace without dashboard navigation or mutation controls", () => {
    render(<EvaluationWorkspace context={context} />);

    expect(screen.getByRole("heading", { name: "KI-Assistenz für kommunale NOLIS-Kunden" })).toBeInTheDocument();
    expect(screen.getByText(/NOLIS-gebrandetes KI-Zusatzmodul/i)).toBeInTheDocument();
    expect(screen.getByText("Kooperationsdemonstrator")).toBeInTheDocument();
    expect(screen.getByText("Nur-Lesezugang")).toBeInTheDocument();
    expect(screen.getByText("Für NOLIS")).toBeInTheDocument();
    expect(screen.getByText("Wiederkehrend vermarktbares KI-Zusatzmodul für kommunale Bestandskunden.")).toBeInTheDocument();
    expect(screen.getByText("Bürgerservice")).toBeInTheDocument();
    expect(screen.getByText("Quellenbasierte Antwortlogik")).toBeInTheDocument();
    expect(screen.getByText("Premium/OEM")).toBeInTheDocument();
    expect(screen.getByText("Neuen Reisepass vorbereiten")).toBeInTheDocument();
    expect(screen.getByText("Formular lässt sich nicht absenden")).toBeInTheDocument();
    expect(screen.getByText("Keine falsche externe Übergabe behaupten")).toBeInTheDocument();
    expect(screen.queryByText("Einstellungen")).not.toBeInTheDocument();
    expect(screen.queryByText("Importieren")).not.toBeInTheDocument();
    expect(screen.queryByText("Löschen")).not.toBeInTheDocument();
    expect(screen.getByText("Starten Sie mit einer Beispielkarte oder eigener Testfrage.")).toBeInTheDocument();
    expect(screen.getByText(/Bitte geben Sie keine Passwörter, MFA-Codes, API-Schlüssel/i)).toBeInTheDocument();
    expect(screen.getByText(/Diese Ansicht ist ein Demonstrator/i)).toBeInTheDocument();
    expect(screen.getByText(/Ablauf, Inhalte, Fragen und Übergaben können für Kundenprojekte angepasst werden/i)).toBeInTheDocument();
  });

  test("scenario card only copies prompt and does not send automatically", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<EvaluationWorkspace context={context} />);

    await userEvent.click(screen.getByRole("button", { name: /Neuen Reisepass vorbereiten/i }));

    expect(screen.getByPlaceholderText("Testfrage eingeben...")).toHaveValue("Ich brauche einen neuen Reisepass.");
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "mock_delivered",
          demoReference: "DEMO-12345678",
          attemptCount: 1,
          signatureVerified: true,
          duplicateRecognized: false,
          receivedAt: "2026-06-24T10:00:00.000Z",
          message: "Die signierte Demo-Übergabe wurde vom internen Mock-Empfänger bestätigt.",
          externalNotice: "Es erfolgte keine Übermittlung an NOLIS oder ein externes Ticketsystem.",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<EvaluationWorkspace context={context} />);

    await userEvent.type(screen.getByPlaceholderText("Testfrage eingeben..."), "Bitte Ticket melden");
    await userEvent.click(screen.getByRole("button", { name: "Senden" }));

    await waitFor(() => {
      expect(screen.getByText("Demo-Supportfall Vorschau")).toBeInTheDocument();
    });
    expect(screen.getByText("Support-Art")).toBeInTheDocument();
    expect(screen.getByText("Produktsupport")).toBeInTheDocument();
    expect(screen.getByText("Bereich / Modul")).toBeInTheDocument();
    expect(screen.getByText("Organisation")).toBeInTheDocument();
    expect(screen.getByText("Auswirkung")).toBeInTheDocument();
    expect(screen.getByText("Hoch")).toBeInTheDocument();
    expect(screen.queryByText("supportProfile")).not.toBeInTheDocument();
    expect(screen.queryByText("customerOrganization")).not.toBeInTheDocument();
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

    expect(screen.getByText("Noch keine Demo-Übergabe ausgeführt.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Signierte Demo-Übergabe simulieren" }));
    await waitFor(() => {
      expect(screen.getByText("Die signierte Demo-Übergabe wurde vom internen Mock-Empfänger bestätigt.")).toBeInTheDocument();
    });
    expect(screen.getByText("Es erfolgte keine Übermittlung an NOLIS oder ein externes Ticketsystem.")).toBeInTheDocument();
    expect(screen.queryByText(/x-ssb-signature|evt_|del_/i)).not.toBeInTheDocument();
  });
});
