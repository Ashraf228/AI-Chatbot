import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ItSupportReadinessCard } from "../components/it-support/ItSupportReadinessCard";

function readiness(overrides: Record<string, unknown> = {}) {
  return {
    status: "ready",
    label: "Produktionsbereit",
    summary: "Der IT-Support-Agent ist einsatzbereit.",
    checks: {
      itSupportEnabled: true,
      knowledgeFaqEnabled: true,
      activeKnowledgeSourcesAvailable: true,
      itKnowledgeTemplatesImported: true,
      requiredTicketFieldsValid: true,
      ticketConfirmationRequired: true,
      escalationKeywordsConfigured: true,
      ticketForwardingConfigured: true,
    },
    missing: [],
    warnings: [],
    actions: [
      {
        key: "test-ticket-webhook",
        label: "Ticket-Webhook testen",
        href: "/sites/site-1/integrations",
        severity: "secondary",
      },
      {
        key: "open-test-chat",
        label: "Testchat öffnen",
        href: "/sites/site-1#customer-test-chat",
        severity: "primary",
      },
    ],
    details: {
      importedItKnowledgeTemplateCount: 1,
      availableItKnowledgeTemplateCount: 15,
      activeKnowledgeSourceCount: 2,
      ticketWebhook: {
        enabled: true,
        forwardingConfigured: true,
        hasSigningSecret: true,
        lastTestStatus: "queued",
        lastTestAt: "2026-06-10T12:00:00.000Z",
      },
    },
    ...overrides,
  };
}

function stubReadinessResponse(data: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("ItSupportReadinessCard", () => {
  test("renders ready status without exposing signing secrets", async () => {
    stubReadinessResponse(readiness());

    render(<ItSupportReadinessCard siteId="site-1" />);

    expect(await screen.findByText("Produktionsbereit")).toBeInTheDocument();
    expect(screen.getByText("IT-Support-Agent Status")).toBeInTheDocument();
    expect(screen.getByText("Ticket-Webhook testen")).toBeInTheDocument();
    expect(screen.getByText("Signing Secret vorhanden. Der Wert wird nicht angezeigt.")).toBeInTheDocument();
    expect(screen.queryByText(/secret-value/i)).not.toBeInTheDocument();
  });

  test("renders warnings and disabled template import action", async () => {
    stubReadinessResponse(
      readiness({
        status: "warning",
        label: "Fast bereit",
        summary: "Der IT-Support-Agent ist nutzbar, aber einige Punkte sollten vor dem Go-live geprüft werden.",
        checks: {
          ...readiness().checks,
          activeKnowledgeSourcesAvailable: false,
          itKnowledgeTemplatesImported: false,
          ticketForwardingConfigured: false,
        },
        warnings: [
          "Ticket-Weiterleitung ist noch nicht konfiguriert.",
          "Keine aktiven Wissensquellen oder importierten IT-Templates sind als vorhanden markiert.",
        ],
        actions: [
          {
            key: "configure-ticket-webhook",
            label: "Ticket-Weiterleitung konfigurieren",
            href: "/sites/site-1/integrations",
            severity: "warning",
          },
          {
            key: "import-it-templates",
            label: "IT-Templates importieren",
            description: "Backend-Templates sind vorbereitet; eine Dashboard-Importmaske folgt separat.",
            href: "/sites/site-1/knowledge",
            severity: "secondary",
            disabled: true,
          },
        ],
        details: {
          ...readiness().details,
          activeKnowledgeSourceCount: 0,
          importedItKnowledgeTemplateCount: 0,
          ticketWebhook: {
            enabled: false,
            forwardingConfigured: false,
            hasSigningSecret: false,
            lastTestStatus: null,
            lastTestAt: null,
          },
        },
      }),
    );

    render(<ItSupportReadinessCard siteId="site-1" />);

    expect(await screen.findByText("Fast bereit")).toBeInTheDocument();
    expect(screen.getByText("Ticket-Weiterleitung ist noch nicht konfiguriert.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IT-Templates importieren" })).toBeDisabled();
  });

  test("renders not_ready missing checks", async () => {
    stubReadinessResponse(
      readiness({
        status: "not_ready",
        label: "Nicht bereit",
        summary: "Der IT-Support-Agent ist noch nicht vollständig eingerichtet.",
        checks: {
          ...readiness().checks,
          itSupportEnabled: false,
          knowledgeFaqEnabled: false,
        },
        missing: ["it-support Modul ist nicht aktiv.", "knowledge-faq Modul ist nicht aktiv."],
      }),
    );

    render(<ItSupportReadinessCard siteId="site-1" />);

    expect(await screen.findByText("Nicht bereit")).toBeInTheDocument();
    expect(screen.getByText("it-support Modul ist nicht aktiv.")).toBeInTheDocument();
    expect(screen.getByText("knowledge-faq Modul ist nicht aktiv.")).toBeInTheDocument();
  });
});
