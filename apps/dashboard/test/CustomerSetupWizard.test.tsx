import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { CustomerSetupWizard } from "../components/customer/CustomerSetupWizard";
import { LaunchStep } from "../components/customer/setup-wizard/LaunchStep";
import { updateSiteSettings } from "../lib/setup-wizard-api";

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
