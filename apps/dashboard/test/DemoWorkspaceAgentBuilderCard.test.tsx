import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DemoWorkspaceAgentBuilderCard } from "../components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard";

describe("DemoWorkspaceAgentBuilderCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

    await userEvent.click(screen.getByRole("button", { name: "Demo-Agent simulieren" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("support")).toBeInTheDocument();
    expect(screen.getByText("support-agent")).toBeInTheDocument();
    expect(screen.getByText("Ich kann das als Demo-Supportfall sicher einordnen.")).toBeInTheDocument();
    expect(screen.getByText(/publicWidgetActivation=false/)).toBeInTheDocument();
  });
});
