import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DemoWorkspaceAgentBuilderCard } from "../components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard";

describe("DemoWorkspaceAgentBuilderCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("shows the required safety caveats and omits persistence or deployment actions", () => {
    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);

    expect(screen.getByText("Sicherheitsgrenzen")).toBeInTheDocument();
    expect(screen.getAllByText("Nur Admin-/Operator-Testpfad")).toHaveLength(2);
    expect(screen.getByText("Nur synthetische/in-memory Konfiguration")).toBeInTheDocument();
    expect(screen.getAllByText("Keine Kundendaten")).toHaveLength(2);
    expect(screen.getAllByText("Keine Production-Daten")).toHaveLength(2);
    expect(screen.getByText("Nicht gespeichert")).toBeInTheDocument();
    expect(screen.getAllByText("Kein Deploy")).toHaveLength(2);
    expect(screen.getAllByText("Keine Public-Widget-Aktivierung")).toHaveLength(2);
    expect(screen.getAllByText("Kein PDF-Upload")).toHaveLength(2);
    expect(screen.getAllByText("Kein Knowledge-Upload")).toHaveLength(2);
    expect(screen.getAllByText("Keine echten Tickets, E-Mails oder Webhooks")).toHaveLength(2);
    expect(screen.getByText("Demo Workspace Testchat (MVP)")).toBeInTheDocument();
    expect(screen.getByText("Chatverlauf wird nicht gespeichert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Testnachricht senden" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In-Memory-Chat leeren" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deploy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /knowledge upload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /live schalten/i })).not.toBeInTheDocument();
  });

  test("submits structured demo workspace context and renders runtime pilot result", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body.message).toBe("Bitte simuliere einen sicheren Demo-Supportfall.");
      expect(body.demoWorkspace.assistantName).toBe("Demo Builder");
      expect(body.demoWorkspace.assistantRole).toBe("Demo-Support");
      expect(body.demoWorkspace.targetAudience).toEqual(["Ops-Team", "Support-Leads"]);
      expect(body.demoWorkspace.allowedTasks).toEqual(["answer_questions", "triage_support"]);
      expect(body.demoWorkspace.blockedTasks).toEqual(["deploy"]);
      expect(body.demoWorkspace.requiredFields).toEqual(["fullName", "email"]);
      expect(body.knowledgeSnippets).toHaveLength(2);
      expect(body.history).toEqual([]);
      expect(body.existingConversationState.testChatMode).toBe("demo_workspace_in_memory_testchat_mvp");
      expect(body.existingConversationState.chatHistoryPersistence).toBe(false);

      return new Response(
        JSON.stringify({
          runtimePilotEnabled: true,
          activationBoundary: {
            mode: "admin_test_only",
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
            sourcesUsed: 2,
            sourceRequired: true,
          },
          conversationEnginePreview: {
            intent: "support",
            goal: "solve_problem",
            stage: "answer",
            selectedAgentKey: "support-agent",
            nextAction: "Frage aus der Wissensbasis beantworten",
            shouldHandoff: false,
            missingFields: ["fullName"],
          },
          engineResponsePreview: {
            draft: {
              text: "Ich kann das als Demo-Supportfall sicher einordnen.",
              nextActionLabel: "Antwort aus Demo-Wissen geben",
            },
            safety: {
              noSideEffects: true,
              publicWidgetUnaffected: true,
              integrationsSuppressed: true,
              sanitized: true,
            },
          },
          warnings: [],
          reasons: ["Admin-Testpfad ohne Persistenz."],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);

    await userEvent.clear(screen.getByLabelText("Assistant Name"));
    await userEvent.type(screen.getByLabelText("Assistant Name"), "Demo Builder");
    await userEvent.clear(screen.getByLabelText("Assistant Role"));
    await userEvent.type(screen.getByLabelText("Assistant Role"), "Demo-Support");
    await userEvent.type(screen.getByLabelText("Target Audience (eine Zeile oder CSV)"), "Ops-Team, Support-Leads");
    await userEvent.clear(screen.getByLabelText("Allowed Tasks"));
    await userEvent.type(screen.getByLabelText("Allowed Tasks"), "answer_questions{enter}triage_support");
    await userEvent.clear(screen.getByLabelText("Blocked Tasks"));
    await userEvent.type(screen.getByLabelText("Blocked Tasks"), "deploy");
    await userEvent.clear(screen.getByLabelText("Required Fields"));
    await userEvent.type(screen.getByLabelText("Required Fields"), "fullName{enter}email");
    await userEvent.type(
      screen.getByLabelText("Synthetic Knowledge Snippets"),
      "Demo snippet eins{enter}Demo snippet zwei",
    );
    await userEvent.type(
      screen.getByLabelText("Test Message"),
      "Bitte simuliere einen sicheren Demo-Supportfall.",
    );

    await userEvent.click(screen.getByRole("button", { name: "Testnachricht senden" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("support")).toBeInTheDocument();
    expect(screen.getByText("support-agent")).toBeInTheDocument();
    expect(screen.getAllByText("Ich kann das als Demo-Supportfall sicher einordnen.")).toHaveLength(2);
    expect(screen.getAllByText(/publicWidgetActivation=false/)).toHaveLength(2);
    expect(screen.getByText(/ohne Persistenz, ohne Deploy, ohne Public-Widget-Aktivierung/i)).toBeInTheDocument();
    expect(screen.getByText("Turn 1: User")).toBeInTheDocument();
    expect(screen.getByText("Bitte simuliere einen sicheren Demo-Supportfall.")).toBeInTheDocument();
  });

  test("keeps transcript only in memory across multiple turns and clears local state", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.message).toBe("Erster Demo-Fall");
        expect(body.history).toEqual([]);

        return new Response(
          JSON.stringify({
            runtimePilotEnabled: true,
            activationBoundary: {
              mode: "admin_test_only",
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
              sourcesUsed: 1,
              sourceRequired: true,
            },
            conversationEnginePreview: {
              intent: "support",
              goal: "solve_problem",
              stage: "answer",
              selectedAgentKey: "support-agent",
              nextAction: "Antwort geben",
              shouldHandoff: false,
              missingFields: [],
            },
            engineResponsePreview: {
              draft: {
                text: "Erste Demo-Antwort",
                nextActionLabel: "Antwort geben",
              },
              safety: {
                noSideEffects: true,
                publicWidgetUnaffected: true,
                integrationsSuppressed: true,
                sanitized: true,
              },
            },
            warnings: [],
            reasons: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.message).toBe("Zweiter Demo-Fall");
        expect(body.history).toEqual([
          { role: "user", content: "Erster Demo-Fall" },
          { role: "assistant", content: "Erste Demo-Antwort" },
        ]);

        return new Response(
          JSON.stringify({
            runtimePilotEnabled: true,
            activationBoundary: {
              mode: "admin_test_only",
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
              selectedAgentKey: "handoff-agent",
              nextActionKey: "simulate_handoff",
              shouldHandoff: true,
              shouldAskQuestion: false,
              handoffOfferSimulated: true,
              ticketFieldRequestSimulated: false,
              sourcesUsed: 0,
              sourceRequired: false,
            },
            conversationEnginePreview: {
              intent: "complaint",
              goal: "handoff",
              stage: "escalate",
              selectedAgentKey: "handoff-agent",
              nextAction: "Handoff vorbereiten",
              shouldHandoff: true,
              missingFields: ["email"],
            },
            engineResponsePreview: {
              draft: {
                text: "Zweite Demo-Antwort",
                nextActionLabel: "Handoff vorbereiten",
              },
              safety: {
                noSideEffects: true,
                publicWidgetUnaffected: true,
                integrationsSuppressed: true,
                sanitized: true,
              },
            },
            warnings: ["Nur Demo."],
            reasons: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);

    await userEvent.type(screen.getByLabelText("Test Message"), "Erster Demo-Fall");
    await userEvent.click(screen.getByRole("button", { name: "Testnachricht senden" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText("Erste Demo-Antwort")).toHaveLength(2);
    expect(screen.getByText("Turn 1: User")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Test Message"), "Zweiter Demo-Fall");
    await userEvent.click(screen.getByRole("button", { name: "Testnachricht senden" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Zweite Demo-Antwort")).toHaveLength(2);
    expect(screen.getByText("Turn 2: User")).toBeInTheDocument();
    expect(screen.getAllByText(/Side Effects:/)).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "In-Memory-Chat leeren" }));

    expect(screen.getByText("Noch keine Testnachricht gesendet. Der Transcript lebt nur im Browser-State.")).toBeInTheDocument();
    expect(screen.queryByText("Erster Demo-Fall")).not.toBeInTheDocument();
    expect(screen.queryByText("Zweite Demo-Antwort")).not.toBeInTheDocument();
  });
});
