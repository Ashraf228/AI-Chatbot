import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CustomerSetupWizard } from "../components/customer/CustomerSetupWizard";
import { LaunchStep } from "../components/customer/setup-wizard/LaunchStep";
import { SetupReadinessChecklist } from "../components/sites/SetupReadinessChecklist";
import { getSite, updateSiteSettings } from "../lib/setup-wizard-api";

vi.mock("../lib/setup-wizard-api", () => ({
  createManualKnowledgeSource: vi.fn(),
  deleteKnowledgeSource: vi.fn(),
  getKnowledgeSources: vi.fn(async () => []),
  getSite: vi.fn(async () => ({
    id: "site-1",
    name: "Muster Handwerk",
    siteKey: "muster-handwerk",
    allowedDomains: ["kunde.de"],
    companyName: "Muster Handwerk",
    websiteUrl: "https://kunde.de",
    supportEmail: "",
    phone: "",
    language: "de",
    botName: "Service-Assistent",
    logoUrl: "",
    brandColor: "#b55400",
    accentColor: "#fff0d9",
    welcomeMessage: "Guten Tag. Beschreiben Sie kurz, was passiert ist.",
    placeholderText: "Nachricht schreiben...",
    widgetPosition: "bottom_right",
    launcherLabel: "Soforthilfe",
    privacyUrl: "https://kunde.de/datenschutz",
    privacyNoticeText: "",
    fontFamily: "system",
    systemPrompt: "",
    industry: "local-service-first-contact",
    botType: "handwerker-first-contact",
    setupGoal: "lead_capture",
    primaryGoal: "lead_generation",
    tone: "professional",
    knowledgeMode: "flexible",
    fallbackBehavior: "ask_followup",
    conversationFlow: {},
    enabledTasks: [],
    assistantProfile: null,
    ctaText: "Soforthilfe",
    leadCaptureEnabled: true,
    leadNotificationEmail: "",
    consentRequired: true,
    templateId: "local-service-first-contact",
    templateVersion: 1,
    templateAppliedAt: "2026-05-29T10:00:00.000Z",
    lastTestedAt: "",
    lastTestQuestion: "",
    lastTestAnswer: "",
    goLiveAt: "",
  })),
  importUrlKnowledgeSource: vi.fn(),
  resyncKnowledgeSource: vi.fn(),
  setKnowledgeSourceActive: vi.fn(),
  setSiteGoLive: vi.fn(),
  updateSiteBasics: vi.fn(),
  updateSiteBranding: vi.fn(),
  updateSiteSettings: vi.fn(async () => ({})),
  uploadKnowledgePdf: vi.fn(),
}));

describe("CustomerSetupWizard", () => {
  beforeEach(() => {
    vi.mocked(getSite).mockClear();
    vi.mocked(updateSiteSettings).mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/industry-templates")) {
          return new Response(
            JSON.stringify([
              {
                key: "local-service-first-contact",
                version: 1,
                label: "Handwerker / Erstkontakt",
                setupGoal: "lead_capture",
                welcomeMessage: "Guten Tag. Beschreiben Sie kurz, was passiert ist.",
                systemPrompt: "",
                recommendedQuestions: { "/": ["Was kostet ein Einsatz?"] },
                modules: [],
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/api/sites/site-1/status")) {
          return new Response(
            JSON.stringify({
              siteId: "site-1",
              code: "setup_incomplete",
              label: "Setup unvollständig",
              status: "Setup unvollständig",
              severity: "warning",
              progress: 75,
              lifecycleStatus: "ready_for_test",
              isLiveReady: false,
              missingSteps: ["lead_delivery"],
              nextAction: {
                key: "lead_delivery",
                label: "Lead-Empfänger-E-Mail setzen",
              },
              steps: [
                { key: "basics", label: "Firma & Domain", status: "complete" },
                { key: "template", label: "Branche & Vorlage", status: "complete" },
                {
                  key: "lead_delivery",
                  label: "Lead-Zustellung",
                  status: "warning",
                  missingReason: "Lead-Empfänger-E-Mail fehlt.",
                },
              ],
              knowledgeCount: 0,
              industry: "local-service-first-contact",
              setupGoal: "lead_capture",
              lastTestedAt: "",
              goLiveAt: "",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  test("loads and saves the lead recipient email in the delivery step", async () => {
    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /Anfrage-Zustellung/i }));

    const emailField = screen.getByPlaceholderText("info@unternehmen.de");
    await userEvent.type(emailField, "info@unternehmen.de");
    await userEvent.click(screen.getByRole("button", { name: /^Speichern$/ }));

    await waitFor(() =>
      expect(updateSiteSettings).toHaveBeenCalledWith("site-1", {
        leadCaptureEnabled: true,
        leadNotificationEmail: "info@unternehmen.de",
      }),
    );
  });

  test("saves the KI-Mitarbeiter step with neutral defaults for a site without legacy industry", async () => {
    vi.mocked(getSite).mockResolvedValueOnce({
      id: "site-1",
      name: "Musterkunde",
      siteKey: "musterkunde",
      allowedDomains: ["kunde.de"],
      companyName: "Musterkunde",
      websiteUrl: "https://kunde.de",
      supportEmail: "",
      phone: "",
      language: "de",
      botName: "Service-Assistent",
      logoUrl: "",
      brandColor: "#b55400",
      accentColor: "#fff0d9",
      welcomeMessage: "",
      placeholderText: "Nachricht schreiben...",
      widgetPosition: "bottom_right",
      launcherLabel: "Chat",
      privacyUrl: "",
      privacyNoticeText: "",
      fontFamily: "system",
      systemPrompt: "",
      industry: "",
      botType: "universal-assistant",
      setupGoal: "",
      primaryGoal: "",
      tone: "",
      knowledgeMode: "flexible",
      fallbackBehavior: "ask_followup",
      conversationFlow: {},
      enabledTasks: [],
      assistantProfile: null,
      ctaText: "",
      leadCaptureEnabled: true,
      leadNotificationEmail: "",
      consentRequired: true,
      templateId: "",
      templateVersion: null,
      templateAppliedAt: "",
      lastTestedAt: "",
      lastTestQuestion: "",
      lastTestAnswer: "",
      goLiveAt: "",
    });

    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /KI-Mitarbeiter/i }));

    expect(screen.getByLabelText("Aufgabe des KI-Mitarbeiters")).toHaveValue("lead_generation");
    expect(screen.getByText("Lege fest, was der KI-Mitarbeiter hauptsächlich übernehmen soll.")).toBeInTheDocument();
    expect(screen.getByLabelText("Kommunikationsstil")).toHaveValue("professional");
    expect(screen.getByText("Bestimmt, wie der KI-Mitarbeiter formuliert.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ziel des Chatfensters")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tonalität")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Speichern & weiter$/ }));

    await waitFor(() =>
      expect(updateSiteSettings).toHaveBeenCalledWith(
        "site-1",
        expect.objectContaining({
          primaryGoal: "lead_generation",
          setupGoal: "lead_generation",
          industry: "",
          botType: "universal-assistant",
          tone: "professional",
          ctaText: "Anfrage aufnehmen",
          enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff"],
          conversationEngine: {
            previewEnabled: false,
            compareEnabled: false,
            responsePreviewEnabled: false,
            knowledgePreviewEnabled: false,
            adminTestOnly: true,
          },
        }),
      ),
    );
    expect(screen.queryByText("Aktion konnte nicht ausgeführt werden.")).not.toBeInTheDocument();
  });

  test("skips the KI-Mitarbeiter step without sending an incomplete settings payload", async () => {
    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /KI-Mitarbeiter/i }));
    await userEvent.click(screen.getByRole("button", { name: "Später erledigen" }));

    expect(screen.getByText(/Schritt 3 von 7: Anfrage-Zustellung/i)).toBeInTheDocument();
    expect(updateSiteSettings).not.toHaveBeenCalled();
    expect(screen.queryByText("Aktion konnte nicht ausgeführt werden.")).not.toBeInTheDocument();
  });

  test("shows a universal conversation logic step without local-service defaults", async () => {
    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /Gesprächslogik/i }));

    expect(screen.getByRole("heading", { name: "Gesprächslogik" })).toBeInTheDocument();
    expect(screen.getByText("Universeller Ablauf")).toBeInTheDocument();
    expect(screen.getByText(/Anliegen verstehen → Antwort aus Wissen prüfen/i)).toBeInTheDocument();
    expect(screen.getByText("Wissensantwort prüfen")).toBeInTheDocument();
    expect(screen.getByText("Pflichtinformationen sammeln")).toBeInTheDocument();
    expect(screen.getByText("Übergabe vorbereiten")).toBeInTheDocument();
    expect(screen.getByText("Produkt / Thema")).toBeInTheDocument();
    expect(screen.getByText("Ticket vorbereiten")).toBeInTheDocument();

    expect(screen.queryByText("Handwerker-Erstkontakt")).not.toBeInTheDocument();
    expect(screen.queryByText(/Standardflow für Handwerker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/vollständige Einsatzadresse/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vor- und Nachname/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Telefonnummer/i)).not.toBeInTheDocument();
  });

  test("toggles and saves universal conversation logic chips", async () => {
    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /Gesprächslogik/i }));

    const emailChip = screen.getByRole("button", { name: "E-Mail" });
    const supportChip = screen.getByRole("button", { name: "Supportfall vorbereiten" });

    expect(emailChip).toHaveAttribute("aria-pressed", "true");
    expect(supportChip).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(emailChip);
    await userEvent.click(supportChip);

    expect(emailChip).toHaveAttribute("aria-pressed", "false");
    expect(supportChip).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: /^Speichern$/ }));

    await waitFor(() =>
      expect(updateSiteSettings).toHaveBeenCalledWith(
        "site-1",
        expect.objectContaining({
          conversationFlow: expect.objectContaining({
            requiredFields: ["name", "request"],
          }),
          enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff", "support"],
        }),
      ),
    );
  });

  test("saves and reloads stored universal conversation logic selections", async () => {
    vi.mocked(getSite).mockResolvedValueOnce({
      id: "site-1",
      name: "Musterkunde",
      siteKey: "musterkunde",
      allowedDomains: ["kunde.de"],
      companyName: "Musterkunde",
      websiteUrl: "https://kunde.de",
      supportEmail: "",
      phone: "",
      language: "de",
      botName: "Service-Assistent",
      logoUrl: "",
      brandColor: "#b55400",
      accentColor: "#fff0d9",
      welcomeMessage: "",
      placeholderText: "Nachricht schreiben...",
      widgetPosition: "bottom_right",
      launcherLabel: "Chat",
      privacyUrl: "",
      privacyNoticeText: "",
      fontFamily: "system",
      systemPrompt: "",
      industry: "",
      botType: "universal-assistant",
      setupGoal: "",
      primaryGoal: "",
      tone: "",
      knowledgeMode: "flexible",
      fallbackBehavior: "ask_followup",
      conversationFlow: { requiredFields: ["phone", "product_or_topic"] },
      enabledTasks: ["support", "create_ticket"],
      assistantProfile: null,
      ctaText: "",
      leadCaptureEnabled: true,
      leadNotificationEmail: "",
      consentRequired: true,
      templateId: "",
      templateVersion: null,
      templateAppliedAt: "",
      lastTestedAt: "",
      lastTestQuestion: "",
      lastTestAnswer: "",
      goLiveAt: "",
    });

    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /Gesprächslogik/i }));

    expect(screen.getByRole("button", { name: "Telefon" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Produkt / Thema" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "E-Mail" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Supportfall vorbereiten" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ticket vorbereiten" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/vollständige Einsatzadresse/i)).not.toBeInTheDocument();
  });

  test("does not send a broken flow payload when skipping conversation logic", async () => {
    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /Gesprächslogik/i }));
    await userEvent.click(screen.getByRole("button", { name: "Später erledigen" }));

    expect(screen.getByText(/Schritt 5 von 7: Wissen/i)).toBeInTheDocument();
    expect(updateSiteSettings).not.toHaveBeenCalled();
    expect(screen.queryByText("Aktion konnte nicht ausgeführt werden.")).not.toBeInTheDocument();
  });

  test("keeps legacy conversation flows behind the advanced area", async () => {
    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /Gesprächslogik/i }));

    expect(screen.getByText("Erweitert: Legacy-Gesprächsabläufe")).toBeInTheDocument();
    expect(screen.getByText(/Neue KI-Mitarbeiter nutzen die universelle Gesprächslogik/i)).toBeInTheDocument();
  });
});

describe("SetupReadinessChecklist", () => {
  test("does not show design missing status on the conversation logic item", () => {
    render(
      <SetupReadinessChecklist
        siteId="site-1"
        status={{
          siteId: "site-1",
          code: "setup_incomplete",
          label: "Setup unvollständig",
          status: "Setup unvollständig",
          severity: "warning",
          progress: 70,
          lifecycleStatus: "setup_incomplete",
          isLiveReady: false,
          missingSteps: ["design"],
          nextAction: { key: "design", label: "Design prüfen" },
          steps: [
            { key: "behavior", label: "KI-Mitarbeiter Profil", status: "complete" },
            { key: "design", label: "Design & Datenschutz", status: "warning", missingReason: "Design fehlt." },
          ],
          knowledgeCount: 0,
          industry: "",
          setupGoal: "lead_generation",
          lastTestedAt: "",
          goLiveAt: "",
        }}
      />,
    );

    const conversationItem = screen.getByRole("link", { name: /Gesprächslogik/i });
    expect(within(conversationItem).queryByText(/Design fehlt/i)).not.toBeInTheDocument();
    expect(within(conversationItem).getByText(/Antworten, Rückfragen, Pflichtinformationen/i)).toBeInTheDocument();
  });
});

function launchProps(role?: "admin" | "operator" | "customer" | "viewer" | null) {
  return {
    site: {
      id: "site-1",
      name: "Muster Handwerk",
      siteKey: "muster-handwerk",
      allowedDomains: ["kunde.de"],
      companyName: "Muster Handwerk",
      websiteUrl: "https://kunde.de",
      supportEmail: "",
      phone: "",
      language: "de" as const,
      botName: "Service-Assistent",
      logoUrl: "",
      brandColor: "#b55400",
      accentColor: "#fff0d9",
      welcomeMessage: "Guten Tag.",
      placeholderText: "Nachricht schreiben...",
      widgetPosition: "bottom_right" as const,
      launcherLabel: "Soforthilfe",
      privacyUrl: "https://kunde.de/datenschutz",
      privacyNoticeText: "",
      fontFamily: "system",
      systemPrompt: "",
      industry: "local-service-first-contact",
      botType: "handwerker-first-contact",
      setupGoal: "lead_capture",
      primaryGoal: "lead_generation" as const,
      tone: "professional" as const,
      knowledgeMode: "flexible" as const,
      fallbackBehavior: "ask_followup" as const,
      conversationFlow: {},
      enabledTasks: [],
      assistantProfile: null,
      ctaText: "Soforthilfe",
      leadCaptureEnabled: true,
      leadNotificationEmail: "",
      consentRequired: true,
      templateId: "local-service-first-contact",
      templateVersion: 1,
      templateAppliedAt: "",
      lastTestedAt: "",
      lastTestQuestion: "",
      lastTestAnswer: "",
      goLiveAt: "",
    },
    serverStatus: null,
    overallStatus: "Setup unvollständig",
    embedCode: "<script></script>",
    copiedEmbedCode: false,
    testQuestion: "",
    testMessages: [],
    savingKey: null,
    canGoLive: false,
    isLive: false,
    status: "warning" as const,
    onChangeTestQuestion: vi.fn(),
    onSendTestMessage: vi.fn(),
    onCopyEmbedCode: vi.fn(),
    onGoLive: vi.fn(),
    onJumpToStatusStep: vi.fn(),
    dashboardRole: role,
  };
}

describe("LaunchStep admin test tools", () => {
  test.each(["admin", "operator"] as const)("%s sees assistant profile test card", (role) => {
    render(<LaunchStep {...launchProps(role)} />);

    expect(screen.getByText("KI-Mitarbeiter Profil")).toBeInTheDocument();
    expect(screen.getByText("Gesprächslogik Testfälle")).toBeInTheDocument();
    expect(screen.getByText("Gesprächslogik Vorschau")).toBeInTheDocument();
  });

  test.each(["customer", null] as const)("%s does not render assistant profile test card", (role) => {
    render(<LaunchStep {...launchProps(role)} />);

    expect(screen.queryByText("KI-Mitarbeiter Profil")).not.toBeInTheDocument();
    expect(screen.queryByText("Gesprächslogik Testfälle")).not.toBeInTheDocument();
    expect(screen.queryByText("Gesprächslogik Vorschau")).not.toBeInTheDocument();
  });
});
