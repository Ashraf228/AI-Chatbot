import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CustomerSetupWizard } from "../components/customer/CustomerSetupWizard";
import { LaunchStep } from "../components/customer/setup-wizard/LaunchStep";
import { statusForWizardStep, wizardStepStatusLabel } from "../components/customer/setup-wizard/setupWizardValidation";
import { SetupReadinessChecklist } from "../components/sites/SetupReadinessChecklist";
import { getSite, updateAssistantProfileConfig, updateSiteSettings } from "../lib/setup-wizard-api";

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
  updateAssistantProfileConfig: vi.fn(async () => ({})),
  updateSiteBasics: vi.fn(),
  updateSiteBranding: vi.fn(),
  updateSiteSettings: vi.fn(async () => ({})),
  uploadKnowledgePdf: vi.fn(),
}));

describe("CustomerSetupWizard", () => {
  beforeEach(() => {
    vi.mocked(getSite).mockClear();
    vi.mocked(updateAssistantProfileConfig).mockClear();
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
      expect(updateAssistantProfileConfig).toHaveBeenCalledWith(
        "site-1",
        expect.objectContaining({
          assistantProfile: expect.objectContaining({
            profileKey: "universal-assistant",
            profileVersion: 1,
            role: "Anfragen aufnehmen und qualifizieren",
            tone: "professional",
            answerStyle: "concise",
            knowledgeMode: "flexible",
            enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff"],
          }),
          updatedFrom: "dashboard-wizard",
        }),
      ),
    );
    expect(updateSiteSettings).toHaveBeenCalledWith("site-1", { ctaText: "Anfrage aufnehmen" });
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        assistantProfile: expect.anything(),
      }),
    );
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        enabledTasks: expect.anything(),
      }),
    );
    expect(screen.queryByText("Aktion konnte nicht ausgeführt werden.")).not.toBeInTheDocument();
  });

  test("loads stored assistant profile values into KI-Mitarbeiter selects", async () => {
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
      industry: "generic",
      botType: "universal-assistant",
      setupGoal: "",
      primaryGoal: "",
      tone: "",
      knowledgeMode: "flexible",
      fallbackBehavior: "ask_followup",
      conversationFlow: {},
      enabledTasks: [],
      assistantProfile: {
        profileKey: "universal-assistant",
        profileVersion: 1,
        role: "Support und Kundenhilfe",
        tone: "professional",
        answerStyle: "concise",
        knowledgeMode: "grounded",
        enabledTasks: ["answer_questions", "collect_requests"],
        requiredFields: [
          { key: "name", label: "Name", required: true },
          { key: "request", label: "Anliegen", required: true },
        ],
      },
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

    expect(screen.getByLabelText("Aufgabe des KI-Mitarbeiters")).toHaveValue("support_automation");
    expect(screen.getByLabelText("Kommunikationsstil")).toHaveValue("professional");
    expect(screen.getByText("Mit Wissensbasis")).toBeInTheDocument();
  });

  test("derives KI-Mitarbeiter select defaults from assistant profile tasks", async () => {
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
      industry: "generic",
      botType: "universal-assistant",
      setupGoal: "",
      primaryGoal: "",
      tone: "",
      knowledgeMode: "flexible",
      fallbackBehavior: "ask_followup",
      conversationFlow: {},
      enabledTasks: [],
      assistantProfile: {
        profileKey: "universal-assistant",
        profileVersion: 1,
        role: "",
        tone: "",
        knowledgeMode: "",
        enabledTasks: ["product_advice"],
        requiredFields: [],
      },
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

    expect(screen.getByLabelText("Aufgabe des KI-Mitarbeiters")).toHaveValue("product_questions");
    expect(screen.getByLabelText("Kommunikationsstil")).toHaveValue("professional");
  });

  test("falls back safely for unknown assistant profile role and saves without legacy settings payload", async () => {
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
      industry: "generic",
      botType: "universal-assistant",
      setupGoal: "",
      primaryGoal: "",
      tone: "",
      knowledgeMode: "flexible",
      fallbackBehavior: "ask_followup",
      conversationFlow: {},
      enabledTasks: [],
      assistantProfile: {
        profileKey: "universal-assistant",
        profileVersion: 1,
        role: "Individuelle Sonderrolle",
        tone: "freundlich/professionell",
        knowledgeMode: "grounded",
        enabledTasks: [],
        requiredFields: [],
      },
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
    expect(screen.getByLabelText("Kommunikationsstil")).toHaveValue("professional");

    await userEvent.click(screen.getByRole("button", { name: /^Speichern$/ }));

    await waitFor(() =>
      expect(updateAssistantProfileConfig).toHaveBeenCalledWith(
        "site-1",
        expect.objectContaining({
          assistantProfile: expect.objectContaining({
            profileKey: "universal-assistant",
            role: "Anfragen aufnehmen und qualifizieren",
            tone: "professional",
            enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff"],
          }),
          updatedFrom: "dashboard-wizard",
        }),
      ),
    );
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        primaryGoal: expect.anything(),
        enabledTasks: expect.anything(),
        assistantProfile: expect.anything(),
      }),
    );
  });

  test("treats generic industry with universal assistant as neutral for KI-Mitarbeiter saves", async () => {
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
      industry: "generic",
      botType: "universal-assistant",
      setupGoal: "",
      primaryGoal: "support_automation",
      tone: "professional",
      knowledgeMode: "grounded",
      fallbackBehavior: "ask_followup",
      conversationFlow: { requiredFields: ["name", "email", "request", "product_or_topic"] },
      enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff", "support", "product_advice"],
      assistantProfile: {
        profileKey: "universal-assistant",
        profileVersion: 1,
        requiredFields: [
          { key: "name", label: "Name", required: true },
          { key: "email", label: "E-Mail", required: true },
          { key: "request", label: "Anliegen", required: true },
        ],
        enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff"],
      },
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
    await userEvent.click(screen.getByRole("button", { name: /^Speichern$/ }));

    await waitFor(() =>
      expect(updateAssistantProfileConfig).toHaveBeenCalledWith(
        "site-1",
        expect.objectContaining({
          assistantProfile: expect.objectContaining({
            profileKey: "universal-assistant",
            role: "Support und Kundenhilfe",
            tone: "professional",
            knowledgeMode: "grounded",
          }),
          updatedFrom: "dashboard-wizard",
        }),
      ),
    );
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        primaryGoal: expect.anything(),
        industry: expect.anything(),
      }),
    );
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        enabledTasks: expect.anything(),
      }),
    );
  });

  test("skips the KI-Mitarbeiter step without sending an incomplete settings payload", async () => {
    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /KI-Mitarbeiter/i }));
    await userEvent.click(screen.getByRole("button", { name: "Später erledigen" }));

    expect(screen.getByText(/Schritt 3 von 7: Anfrage-Zustellung/i)).toBeInTheDocument();
    expect(updateAssistantProfileConfig).not.toHaveBeenCalled();
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
      expect(updateAssistantProfileConfig).toHaveBeenCalledWith(
        "site-1",
        expect.objectContaining({
          assistantProfile: expect.objectContaining({
            requiredFields: [
              { key: "name", label: "Name", required: true },
              { key: "request", label: "Anliegen", required: true },
            ],
            enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff", "support"],
          }),
          updatedFrom: "dashboard-wizard",
        }),
      ),
    );
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        conversationFlow: expect.anything(),
      }),
    );
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        enabledTasks: expect.anything(),
      }),
    );
  });

  test("saves generic industry conversation logic through assistant profile despite legacy site fields", async () => {
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
      industry: "generic",
      botType: "universal-assistant",
      setupGoal: "",
      primaryGoal: "support_automation",
      tone: "professional",
      knowledgeMode: "grounded",
      fallbackBehavior: "ask_followup",
      conversationFlow: { requiredFields: ["name", "email", "request", "product_or_topic"] },
      enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff", "support", "product_advice"],
      assistantProfile: {
        profileKey: "universal-assistant",
        profileVersion: 1,
        requiredFields: [
          { key: "name", label: "Name", required: true },
          { key: "email", label: "E-Mail", required: true },
          { key: "request", label: "Anliegen", required: true },
        ],
        enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff"],
      },
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

    expect(screen.getByRole("button", { name: "Name" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "E-Mail" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Produkt / Thema" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Supportfall vorbereiten" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: "Produkt / Thema" }));
    await userEvent.click(screen.getByRole("button", { name: "Supportfall vorbereiten" }));
    await userEvent.click(screen.getByRole("button", { name: /^Speichern$/ }));

    await waitFor(() =>
      expect(updateAssistantProfileConfig).toHaveBeenCalledWith(
        "site-1",
        expect.objectContaining({
          assistantProfile: expect.objectContaining({
            requiredFields: [
              { key: "name", label: "Name", required: true },
              { key: "email", label: "E-Mail", required: true },
              { key: "request", label: "Anliegen", required: true },
              { key: "product_or_topic", label: "Produkt / Thema", required: true },
            ],
            enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff", "support"],
          }),
          updatedFrom: "dashboard-wizard",
        }),
      ),
    );
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        conversationFlow: expect.anything(),
      }),
    );
    expect(updateSiteSettings).not.toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        enabledTasks: expect.anything(),
      }),
    );
  });

  test("keeps legacy conversation flow saves on the legacy settings path", async () => {
    render(<CustomerSetupWizard siteId="site-1" />);

    await screen.findByText("Setup-Assistent");
    await userEvent.click(screen.getByRole("button", { name: /Gesprächslogik/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Speichern$/ }));

    await waitFor(() =>
      expect(updateSiteSettings).toHaveBeenCalledWith(
        "site-1",
        expect.objectContaining({
          conversationFlow: expect.objectContaining({
            requiredFields: ["name", "email", "request"],
          }),
          enabledTasks: ["answer_questions", "collect_requests", "prepare_handoff"],
        }),
      ),
    );
    expect(updateAssistantProfileConfig).not.toHaveBeenCalled();
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
      conversationFlow: { requiredFields: ["name"] },
      enabledTasks: ["answer_questions"],
      assistantProfile: {
        profileKey: "universal-assistant",
        profileVersion: 1,
        requiredFields: [
          { key: "phone", label: "Telefon", required: true },
          { key: "product_or_topic", label: "Produkt / Thema", required: true },
        ],
        enabledTasks: ["support", "create_ticket"],
      },
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
    expect(updateAssistantProfileConfig).not.toHaveBeenCalled();
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

describe("setup wizard status mapping", () => {
  const status = {
    siteId: "site-1",
    code: "setup_incomplete",
    label: "Setup unvollständig",
    status: "Setup unvollständig",
    severity: "warning" as const,
    progress: 70,
    lifecycleStatus: "setup_incomplete" as const,
    isLiveReady: false,
    missingSteps: ["behavior"],
    nextAction: { key: "behavior", label: "Gesprächslogik prüfen" },
    steps: [
      { key: "template", label: "KI-Mitarbeiter Profil", status: "complete" as const },
      {
        key: "behavior",
        label: "Gesprächslogik",
        status: "incomplete" as const,
        missingReason: "Ziel oder Gesprächslogik fehlt.",
      },
    ],
    knowledgeCount: 0,
    industry: "",
    setupGoal: "lead_generation",
    lastTestedAt: "",
    goLiveAt: "",
  };

  test("maps the bot step only to the persisted profile/template contract", () => {
    expect(statusForWizardStep(status, "bot")).toBe("done");
    expect(wizardStepStatusLabel(status, "bot")).toBe("Abgeschlossen");
  });

  test("maps the flow step to the backend behavior status", () => {
    expect(statusForWizardStep(status, "flow")).toBe("pending");
    expect(wizardStepStatusLabel(status, "flow")).toBe("Offen");
  });

  test("renders a partially saved flow step as incomplete", () => {
    const partialStatus = {
      ...status,
      steps: [
        {
          key: "behavior",
          label: "Gesprächslogik",
          status: "warning" as const,
          missingReason: "Ziel oder Gesprächslogik fehlt.",
        },
      ],
    };

    expect(statusForWizardStep(partialStatus, "flow")).toBe("attention");
    expect(wizardStepStatusLabel(partialStatus, "flow")).toBe("Unvollständig");
  });

  test("renders a blocked launch step as blocked instead of an error", () => {
    const launchStatus = {
      ...status,
      steps: [
        { key: "embed", label: "Einbindung", status: "complete" as const },
        { key: "test", label: "Test", status: "incomplete" as const, missingReason: "Test-Chat wurde noch nicht durchgeführt." },
        { key: "live", label: "Live-Schaltung", status: "blocked" as const, missingReason: "Vor Live-Schaltung fehlen noch Pflichtschritte." },
      ],
    };

    expect(statusForWizardStep(launchStatus, "launch")).toBe("attention");
    expect(wizardStepStatusLabel(launchStatus, "launch")).toBe("Blockiert");
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

describe("LaunchStep review gate", () => {
  const hasExactTextContent = (value: string) => (_content: string, node: Element | null) => node?.textContent === value;

  test.each(["admin", "operator"] as const)("%s sees separated advanced diagnostics and no live activation CTA", (role) => {
    render(<LaunchStep {...launchProps(role)} />);

    expect(screen.getByText("Setup-Review")).toBeInTheDocument();
    expect(screen.getByText("Interner Testbereich")).toBeInTheDocument();
    expect(screen.getByText("Aktivierungsgrenze")).toBeInTheDocument();
    expect(screen.getByText("Advanced Diagnostics")).toBeInTheDocument();
    expect(screen.getByText(hasExactTextContent("Deploy: nicht freigegeben"))).toBeInTheDocument();
    expect(screen.getByText(hasExactTextContent("Public Widget: nicht aktiviert"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Live schalten" })).not.toBeInTheDocument();
    expect(screen.getByText("KI-Mitarbeiter Profil")).toBeInTheDocument();
    expect(screen.getByText("Gesprächslogik Testfälle")).toBeInTheDocument();
    expect(screen.getByText("Gesprächslogik Vorschau")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Agent Workspace / Pilot Workspace")).toBeInTheDocument();
  });

  test.each(["customer", null] as const)("%s keeps the review gate but hides advanced diagnostics", (role) => {
    render(<LaunchStep {...launchProps(role)} />);

    expect(screen.getByText("Setup-Review")).toBeInTheDocument();
    expect(screen.getByText("Interner Testbereich")).toBeInTheDocument();
    expect(screen.getByText("Aktivierungsgrenze")).toBeInTheDocument();
    expect(screen.queryByText("Advanced Diagnostics")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Live schalten" })).not.toBeInTheDocument();
    expect(screen.queryByText("KI-Mitarbeiter Profil")).not.toBeInTheDocument();
    expect(screen.queryByText("Gesprächslogik Testfälle")).not.toBeInTheDocument();
    expect(screen.queryByText("Gesprächslogik Vorschau")).not.toBeInTheDocument();
    expect(screen.queryByText("Enterprise Agent Workspace / Pilot Workspace")).not.toBeInTheDocument();
  });
});
