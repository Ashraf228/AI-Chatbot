import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SiteForm } from "../components/sites/SiteForm";

const baseForm = {
  siteKey: "",
  tenantId: "t-default",
  name: "",
  domain: "localhost",
  industry: "",
  botType: "universal-assistant",
};

const templates = [
  {
    key: "local-service-first-contact",
    version: 1,
    label: "Handwerker / Erstkontakt",
    description: "Legacy local service template",
    setupGoal: "lead_capture",
    welcomeMessage: "Guten Tag.",
    systemPrompt: "",
    recommendedQuestions: { "/": ["Was kostet ein Einsatz?"] },
    modules: [],
  },
];

describe("SiteForm", () => {
  test("keeps the normal create flow focused on metadata and setup handoff", () => {
    render(
      <SiteForm
        form={baseForm}
        tenantOptions={[{ id: "t-default", name: "Interner Mandant" }]}
        industryOptions={templates}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Kundenname")).toBeInTheDocument();
    expect(screen.getByLabelText("Website oder Hauptdomain")).toBeInTheDocument();
    expect(screen.getByText("Agent-Konfiguration folgt im Setup")).toBeInTheDocument();
    expect(screen.getByText(/Rolle, Zielgruppe, Aufgaben, Übergabe, Wissen, Tests und Livegang/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kunde anlegen" })).toBeInTheDocument();

    expect(screen.queryByLabelText("Unternehmensbeschreibung")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Zielgruppe / Nutzer")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("KI-Mitarbeiter-Rolle")).not.toBeInTheDocument();
    expect(screen.queryByText("Hauptaufgaben der KI")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Übergabe-E-Mail optional")).not.toBeInTheDocument();
    expect(screen.queryByText("Bitte Branche wählen")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Legacy Bot-Typ")).not.toBeVisible();
    expect(screen.queryByText("Kunde mit Vorlage anlegen")).not.toBeInTheDocument();
  });

  test("keeps legacy industry templates hidden under advanced settings", async () => {
    const user = userEvent.setup();
    render(
      <SiteForm
        form={baseForm}
        tenantOptions={[{ id: "t-default", name: "Interner Mandant" }]}
        industryOptions={templates}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Legacy-Branchenprofil")).not.toBeVisible();

    await user.click(screen.getByText("Erweiterte Angaben"));
    await user.click(screen.getByText("Erweitert / Legacy-Branchenprofile"));

    const legacySelect = screen.getByLabelText("Legacy-Branchenprofil");
    expect(legacySelect).toBeInTheDocument();
    expect(within(legacySelect).getByRole("option", { name: "Handwerker / Erstkontakt" })).toBeInTheDocument();
  });
});
