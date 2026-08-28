import { render, screen } from "@testing-library/react";
import { describe, test, vi } from "vitest";
import { TestChatPanel } from "../components/customer/setup-wizard/TestChatPanel";
import type {
  InternalTestChatKnowledgeSnippet,
  InternalTestChatTurn,
  KnowledgeSource,
  SiteDetails,
} from "../components/customer/setup-wizard/setupWizardTypes";

const site: SiteDetails = {
  id: "site-1",
  name: "Interner Teststand",
  siteKey: "internal-test",
  allowedDomains: [],
  companyName: "",
  websiteUrl: "",
  supportEmail: "",
  phone: "",
  language: "de",
  botName: "Soule",
  logoUrl: "",
  brandColor: "#000000",
  accentColor: "#ffffff",
  welcomeMessage: "Willkommen",
  placeholderText: "Frage eingeben",
  widgetPosition: "bottom_right",
  launcherLabel: "Chat",
  privacyUrl: "",
  privacyNoticeText: "",
  fontFamily: "system-ui",
  systemPrompt: "",
  industry: "services",
  botType: "assistant",
  setupGoal: "Support automatisieren",
  primaryGoal: "support_automation",
  tone: "professional",
  knowledgeMode: "grounded",
  fallbackBehavior: "ask_followup",
  conversationFlow: {},
  enabledTasks: [],
  assistantProfile: null,
  ctaText: "Kontakt aufnehmen",
  leadCaptureEnabled: false,
  leadNotificationEmail: "",
  consentRequired: false,
  templateId: "",
  templateVersion: null,
  templateAppliedAt: "",
  lastTestedAt: "",
  lastTestQuestion: "",
  lastTestAnswer: "",
  goLiveAt: "",
};

const readySource: KnowledgeSource = {
  id: "source-1",
  type: "manual",
  title: "FAQ Oeffnungszeiten",
  label: "FAQ Oeffnungszeiten",
  url: "",
  sourceUrl: "",
  status: "ready",
  syncStatus: "ready",
  isActive: true,
  lastSyncedAt: "2026-08-28T08:00:00.000Z",
  errorMessage: "",
  createdAt: "2026-08-28T07:00:00.000Z",
};

function createTurn(overrides: Partial<InternalTestChatTurn> = {}): InternalTestChatTurn {
  return {
    id: "turn-1",
    testedAt: "2026-08-28T09:00:00.000Z",
    userMessage: "Welche Oeffnungszeiten gelten?",
    assistantDraft: "Montag bis Freitag von 9 bis 17 Uhr.",
    usedKnowledgeSnippets: [],
    result: {
      runtimePilotEnabled: true,
      activationBoundary: {
        mode: "internal_test",
        publicWidgetActivation: false,
        productionActivation: false,
        deployRequired: false,
      },
      sideEffects: {
        planned: false,
        ticketDelivery: false,
        emailDelivery: false,
        webhookDelivery: false,
        providerCalls: false,
        dbAccessForNewLogic: false,
        sql: false,
        queryRunner: false,
      },
      runtimeState: {
        selectedAgentKey: "support-agent",
        nextActionKey: "answer_from_knowledge",
        shouldHandoff: false,
        shouldAskQuestion: false,
        handoffOfferSimulated: false,
        ticketFieldRequestSimulated: false,
        sourcesUsed: 0,
        sourceRequired: false,
      },
      conversationEnginePreview: {
        intent: "support",
        goal: "answer_question",
        stage: "answer",
        selectedAgentKey: "support-agent",
        nextAction: "Antwort geben",
        shouldHandoff: false,
        missingFields: [],
      },
      engineResponsePreview: {
        draft: {
          text: "Montag bis Freitag von 9 bis 17 Uhr.",
          nextActionLabel: "Antwort geben",
        },
        safety: {
          noSideEffects: true,
          publicWidgetUnaffected: true,
          integrationsSuppressed: true,
          sanitized: true,
        },
      },
      knowledgeRetrieval: {
        enabled: false,
        attempted: false,
        status: "disabled",
        snippets: [],
        warnings: [],
        reasons: ["Keine synthetischen Wissens-Snippets uebergeben."],
      },
      warnings: [],
      reasons: ["Runtime-Pilot nur im Admin-Testpfad."],
    },
    ...overrides,
  };
}

function renderPanel(turns: InternalTestChatTurn[]) {
  render(
    <TestChatPanel
      site={site}
      sources={turns.length ? [readySource] : []}
      readyActiveSources={turns.length ? [readySource] : []}
      processingSources={[]}
      failedSources={[]}
      turns={turns}
      input=""
      isLoading={false}
      canUseTestTools
      onChangeInput={vi.fn()}
      onSend={vi.fn()}
      onClear={vi.fn()}
    />,
  );
}

describe("TestChatPanel", () => {
  test("shows explicit success evaluation and next step when visible knowledge evidence exists", () => {
    const snippet: InternalTestChatKnowledgeSnippet = {
      id: "snippet-1",
      title: "FAQ Oeffnungszeiten",
      sourceType: "faq",
      excerpt: "Montag bis Freitag von 9 bis 17 Uhr.",
    };

    renderPanel([
      createTurn({
        usedKnowledgeSnippets: [snippet],
        result: {
          ...createTurn().result,
          runtimeState: {
            ...createTurn().result.runtimeState!,
            sourceRequired: true,
            sourcesUsed: 1,
          },
          knowledgeRetrieval: {
            enabled: true,
            attempted: true,
            status: "used",
            snippets: [snippet],
            warnings: [],
            reasons: [],
          },
        },
      }),
    ]);

    expect(screen.getByText("Antwort mit Wissensbezug")).toBeInTheDocument();
    expect(
      screen.getByText(/Die Antwort wirkt wissensbezogen, weil im vorhandenen Testresultat sichtbare Wissenshinweise enthalten sind/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Antwort und sichtbare Wissenshinweise fachlich pruefen; Review vor Livegang bleibt weiterhin erforderlich/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Knowledge / Quellenhinweis")).toBeInTheDocument();
    expect(screen.getByText(/Sichtbar im bestehenden Response-Objekt: FAQ Oeffnungszeiten/i)).toBeInTheDocument();
  });

  test("shows knowledge-limited state without inventing sources when no snippet is visible", () => {
    renderPanel([
      createTurn({
        result: {
          ...createTurn().result,
          runtimeState: {
            ...createTurn().result.runtimeState!,
            sourceRequired: true,
          },
          knowledgeRetrieval: {
            enabled: true,
            attempted: true,
            status: "blocked",
            snippets: [],
            warnings: ["Knowledge-Zugriff fuer diesen Testlauf blockiert."],
            reasons: [],
          },
        },
      }),
    ]);

    expect(screen.getByText("Wissen reicht fuer diese Frage noch nicht")).toBeInTheDocument();
    expect(
      screen.getByText(/Im vorhandenen Testresultat ist kein sichtbarer Quellen- oder Wissensbezug fuer diese Frage enthalten/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Wissensstand pruefen oder ergaenzen und denselben Test danach erneut ausfuehren/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sichtbar im bestehenden Response-Objekt: Keine sichtbaren Wissenshinweise oder Quellenangaben im vorhandenen Testresultat/i),
    ).toBeInTheDocument();
  });

  test("shows explicit error state and keeps the internal-only boundary when no answer draft exists", () => {
    renderPanel([
      createTurn({
        assistantDraft: "",
        result: {
          ...createTurn().result,
          warnings: ["Antwortentwurf konnte nicht erstellt werden."],
          reasons: ["Bitte Eingabe oder Setup-Stand pruefen."],
        },
      }),
    ]);

    expect(screen.getByText("Keine belastbare Testantwort")).toBeInTheDocument();
    expect(
      screen.getByText(/Es liegt noch keine belastbare Testantwort vor. Der Test bleibt intern; es wurde nichts live geschaltet oder ausgeliefert/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Warnungen, Fehler und gespeicherten Setup-Stand pruefen; danach intern erneut testen/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Interner Test ohne Livegang")).toBeInTheDocument();
  });
});
