import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getAllByText("Keine Kundendaten")).toHaveLength(2);
    expect(screen.getAllByText("Keine Production-Daten")).toHaveLength(2);
    expect(screen.getByText("Knowledge wird nicht gespeichert")).toBeInTheDocument();
    expect(screen.getByText("Dateien werden nicht dauerhaft gespeichert")).toBeInTheDocument();
    expect(screen.getByText("Keine Embeddings / kein RAG-Indexing")).toBeInTheDocument();
    expect(screen.getAllByText("Kein Deploy")).toHaveLength(2);
    expect(screen.getAllByText("Keine Public-Widget-Aktivierung")).toHaveLength(2);
    expect(screen.getAllByText("PDF-Text wird nur in-memory extrahiert")).toHaveLength(2);
    expect(screen.getAllByText("Keine echten Tickets, E-Mails oder Webhooks")).toHaveLength(2);
    expect(screen.getByText("In-Memory Knowledge Upload (MVP)")).toBeInTheDocument();
    expect(screen.getByText("Demo Workspace Config Persistence (MVP)")).toBeInTheDocument();
    expect(screen.getByText("Demo Workspace Testchat (MVP)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save demo config" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load saved config" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset saved config" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snippet aus Text hinzufuegen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alle Snippets entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Testnachricht senden" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In-Memory-Chat leeren" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save knowledge/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save chat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deploy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /knowledge upload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /live schalten/i })).not.toBeInTheDocument();
  });

  test("saves only allowed demo config fields and excludes knowledge, pdf and chat state", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body).toEqual({
        assistantName: "Persist Demo Agent",
        companyContext: "Nur fuer interne Admin-Demos.",
        assistantRole: "Demo-Support",
        targetAudience: ["Ops-Team", "Support-Leads"],
        tone: "friendly",
        allowedTasks: ["answer_questions", "prepare_handoff"],
        blockedTasks: ["deploy"],
        handoffAllowed: true,
        ticketAllowed: false,
        requiredFields: ["fullName", "email"],
      });
      expect("knowledgeSnippetDraft" in body).toBe(false);
      expect("knowledgeSnippets" in body).toBe(false);
      expect("testMessage" in body).toBe(false);
      expect("history" in body).toBe(false);

      return new Response(
        JSON.stringify({
          saved: true,
          hasSavedConfig: true,
          savedConfig: {
            version: 1,
            assistantName: "Persist Demo Agent",
            companyContext: "Nur fuer interne Admin-Demos.",
            assistantRole: "Demo-Support",
            targetAudience: ["Ops-Team", "Support-Leads"],
            tone: "friendly",
            allowedTasks: ["answer_questions", "prepare_handoff"],
            blockedTasks: ["deploy"],
            handoffAllowed: true,
            ticketAllowed: false,
            requiredFields: ["fullName", "email"],
            metadata: {
              source: "demo_workspace_agent_builder",
              updatedAt: "2026-07-27T13:00:00.000Z",
              updatedByRole: "admin",
              customerDataAllowed: false,
              knowledgePersistenceEnabled: false,
              chatHistoryPersistenceEnabled: false,
              publicWidgetActivation: false,
              productionActivation: false,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);

    await userEvent.clear(screen.getByLabelText("Assistant Name"));
    await userEvent.type(screen.getByLabelText("Assistant Name"), "Persist Demo Agent");
    await userEvent.clear(screen.getByLabelText("Assistant Role"));
    await userEvent.type(screen.getByLabelText("Assistant Role"), "Demo-Support");
    await userEvent.selectOptions(screen.getByLabelText("Tone"), "friendly");
    await userEvent.clear(screen.getByLabelText("Company Context"));
    await userEvent.type(screen.getByLabelText("Company Context"), "Nur fuer interne Admin-Demos.");
    await userEvent.clear(screen.getByLabelText("Target Audience (eine Zeile oder CSV)"));
    await userEvent.type(screen.getByLabelText("Target Audience (eine Zeile oder CSV)"), "Ops-Team\nSupport-Leads");
    await userEvent.clear(screen.getByLabelText("Allowed Tasks"));
    await userEvent.type(screen.getByLabelText("Allowed Tasks"), "answer_questions\nprepare_handoff");
    await userEvent.clear(screen.getByLabelText("Blocked Tasks"));
    await userEvent.type(screen.getByLabelText("Blocked Tasks"), "deploy");
    await userEvent.clear(screen.getByLabelText("Required Fields"));
    await userEvent.type(screen.getByLabelText("Required Fields"), "fullName\nemail");
    await userEvent.type(screen.getByLabelText("Knowledge Snippet Text"), "Nur lokal.");
    await userEvent.type(screen.getByLabelText("Test Message"), "Bitte nicht speichern.");

    await userEvent.click(screen.getByRole("button", { name: "Save demo config" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Demo-Konfiguration gespeichert. Es wurden nur Agent-Felder gespeichert.")).toBeInTheDocument();
    expect(screen.getByText(/Letzte gespeicherte Demo-Konfiguration: 2026-07-27T13:00:00.000Z · Rolle: admin/)).toBeInTheDocument();
  });

  test("loads saved config into the form without loading knowledge or chat state", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          hasSavedConfig: true,
          savedConfig: {
            version: 1,
            assistantName: "Stored Demo Agent",
            companyContext: "Persistierter Demo-Kontext.",
            assistantRole: "Stored Role",
            targetAudience: ["Finance", "Ops"],
            tone: "consultative",
            allowedTasks: ["answer_questions", "triage_support"],
            blockedTasks: ["deploy", "create_ticket"],
            handoffAllowed: false,
            ticketAllowed: true,
            requiredFields: ["fullName", "email", "description"],
            metadata: {
              source: "demo_workspace_agent_builder",
              updatedAt: "2026-07-27T14:00:00.000Z",
              updatedByRole: "operator",
              customerDataAllowed: false,
              knowledgePersistenceEnabled: false,
              chatHistoryPersistenceEnabled: false,
              publicWidgetActivation: false,
              productionActivation: false,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);
    await userEvent.type(screen.getByLabelText("Knowledge Snippet Text"), "Bleibt lokal.");
    await userEvent.type(screen.getByLabelText("Test Message"), "Bleibt lokal.");

    await userEvent.click(screen.getByRole("button", { name: "Load saved config" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Assistant Name")).toHaveValue("Stored Demo Agent");
    expect(screen.getByLabelText("Assistant Role")).toHaveValue("Stored Role");
    expect(screen.getByLabelText("Tone")).toHaveValue("consultative");
    expect(screen.getByLabelText("Company Context")).toHaveValue("Persistierter Demo-Kontext.");
    expect(screen.getByLabelText("Target Audience (eine Zeile oder CSV)")).toHaveValue("Finance\nOps");
    expect(screen.getByLabelText("Allowed Tasks")).toHaveValue("answer_questions\ntriage_support");
    expect(screen.getByLabelText("Blocked Tasks")).toHaveValue("deploy\ncreate_ticket");
    expect(screen.getByLabelText("Required Fields")).toHaveValue("fullName\nemail\ndescription");
    expect(screen.getByText("Gespeicherte Demo-Konfiguration geladen. Knowledge, PDFs und Chat bleiben unverändert.")).toBeInTheDocument();
    expect(screen.getByLabelText("Knowledge Snippet Text")).toHaveValue("Bleibt lokal.");
    expect(screen.getByLabelText("Test Message")).toHaveValue("Bleibt lokal.");
  });

  test("reset saved config deletes persisted config and keeps persistence boundaries visible", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          deleted: true,
          hadSavedConfig: true,
          hasSavedConfig: false,
          savedConfig: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);
    await userEvent.type(screen.getByLabelText("Knowledge Snippet Text"), "Bleibt in-memory.");
    await userEvent.type(screen.getByLabelText("Test Message"), "Bleibt ebenfalls lokal.");
    await userEvent.click(screen.getByRole("button", { name: "Reset saved config" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Assistant Name")).toHaveValue("Demo Workspace Agent");
    expect(screen.getByLabelText("Assistant Role")).toHaveValue("Digitaler Demo-Assistent fuer Admin-Tests");
    expect(screen.getByText("Gespeicherte Demo-Konfiguration gelöscht. Knowledge, PDFs und Chat wurden nicht gespeichert.")).toBeInTheDocument();
    expect(screen.getByLabelText("Knowledge Snippet Text")).toHaveValue("Bleibt in-memory.");
    expect(screen.getByLabelText("Test Message")).toHaveValue("Bleibt ebenfalls lokal.");
  });

  test("adds text and file snippets only in browser state and can remove or clear them", async () => {
    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);

    await userEvent.type(screen.getByLabelText("Snippet Title (optional)"), "Demo FAQ");
    await userEvent.type(
      screen.getByLabelText("Knowledge Snippet Text"),
      "Nur synthetische Antworten im Demo-Workspace verwenden.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Snippet aus Text hinzufuegen" }));

    expect(screen.getByText("Aktive Knowledge Snippets (1)")).toBeInTheDocument();
    expect(screen.getByText("Demo FAQ")).toBeInTheDocument();
    expect(screen.getByText("Quelle: Paste / In-Memory")).toBeInTheDocument();

    const fileInput = screen.getByLabelText("Text/Markdown-Datei laden");
    const file = new File(["# Demo Runbook\n\nNur fuer synthetische Tests."], "Demo Runbook.md", {
      type: "text/markdown",
    });
    await userEvent.upload(fileInput, file);

    expect(screen.getByText("Aktive Knowledge Snippets (2)")).toBeInTheDocument();
    expect(screen.getByText("Demo Runbook")).toBeInTheDocument();
    expect(screen.getByText("Datei: Demo Runbook.md")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Snippet entfernen" })[0]);
    expect(screen.queryByText("Demo FAQ")).not.toBeInTheDocument();
    expect(screen.getByText("Aktive Knowledge Snippets (1)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Alle Snippets entfernen" }));
    expect(screen.getByText("Aktive Knowledge Snippets (0)")).toBeInTheDocument();
    expect(
      screen.getByText("Noch keine In-Memory-Snippets aktiv. TXT/Markdown/PDF bleibt lokal oder request-lokal und wird nicht gespeichert."),
    ).toBeInTheDocument();
  });

  test("extracts demo PDF text into an in-memory snippet without persistence actions", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("/api/sites/site-1/conversation-engine/knowledge/pdf-extract");
      return new Response(
        JSON.stringify({
          fileName: "Demo Upload.pdf",
          extractedText: "Synthetischer Demo-PDF-Inhalt fuer den Builder.",
          extractedChars: 45,
          originalChars: 45,
          truncated: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);

    const pdfInput = screen.getByLabelText("Demo-PDF laden");
    const pdfFile = new File(["%PDF demo"], "Demo Upload.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(pdfInput, pdfFile);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Aktive Knowledge Snippets (1)")).toBeInTheDocument();
    expect(screen.getByText("Demo Upload")).toBeInTheDocument();
    expect(screen.getByText("Datei: Demo Upload.pdf")).toBeInTheDocument();
    expect(screen.getByText("sourceType=pdf_demo · scope=demo-workspace")).toBeInTheDocument();
    expect(screen.getByText("Synthetischer Demo-PDF-Inhalt fuer den Builder.")).toBeInTheDocument();
  });

  test("rejects non-PDF uploads in the dedicated demo PDF input", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoWorkspaceAgentBuilderCard siteId="site-1" />);

    const pdfInput = screen.getByLabelText("Demo-PDF laden");
    const wrongFile = new File(["plain text"], "notes.txt", { type: "text/plain" });
    fireEvent.change(pdfInput, {
      target: { files: [wrongFile] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Nur .pdf-Dateien mit synthetischen/freigegebenen Demo-Inhalten sind in diesem Schritt erlaubt."),
    ).toBeInTheDocument();
  });

  test("submits structured demo workspace context with active snippets and renders runtime pilot knowledge usage", async () => {
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
      expect(body.knowledgeSnippets[0].title).toBe("Demo FAQ");
      expect(body.knowledgeSnippets[1].title).toBe("Demo Runbook");
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
          knowledgeRetrieval: {
            enabled: true,
            attempted: true,
            status: "available",
            snippets: [
              {
                id: "demo-snippet-1",
                title: "Demo FAQ",
                excerpt: "Nur synthetische Antworten im Demo-Workspace verwenden.",
                score: 0.75,
                sourceType: "synthetic",
                scope: "demo-workspace",
              },
              {
                id: "demo-snippet-2",
                title: "Demo Runbook",
                excerpt: "# Demo Runbook\n\nNur fuer synthetische Tests.",
                score: 0.75,
                sourceType: "synthetic",
                scope: "demo-workspace",
              },
            ],
            warnings: [],
            reasons: ["Nur synthetische, im Request uebergebene Wissens-Snippets wurden verwendet."],
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

    await userEvent.type(screen.getByLabelText("Snippet Title (optional)"), "Demo FAQ");
    await userEvent.type(
      screen.getByLabelText("Knowledge Snippet Text"),
      "Nur synthetische Antworten im Demo-Workspace verwenden.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Snippet aus Text hinzufuegen" }));

    const fileInput = screen.getByLabelText("Text/Markdown-Datei laden");
    const file = new File(["# Demo Runbook\n\nNur fuer synthetische Tests."], "Demo Runbook.md", {
      type: "text/markdown",
    });
    await userEvent.upload(fileInput, file);

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
    expect(screen.getByText(/reiner Admin-Testpfad ohne Persistenz/i)).toBeInTheDocument();
    expect(screen.getByText("Turn 1: User")).toBeInTheDocument();
    expect(screen.getByText("Bitte simuliere einen sicheren Demo-Supportfall.")).toBeInTheDocument();
    expect(screen.getByText("Used Snippet Titles: Demo FAQ, Demo Runbook")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Used: Demo FAQ, Demo Runbook")).toBeInTheDocument();
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
            knowledgeRetrieval: {
              enabled: false,
              attempted: false,
              status: "disabled",
              snippets: [],
              warnings: [],
              reasons: [],
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
            knowledgeRetrieval: {
              enabled: false,
              attempted: false,
              status: "disabled",
              snippets: [],
              warnings: [],
              reasons: [],
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
