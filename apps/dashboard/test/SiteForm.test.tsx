import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SiteForm } from "../components/sites/SiteForm";

const baseForm = {
  siteKey: "",
  tenantId: "t-default",
  name: "",
  domain: "localhost",
  businessDescription: "",
  targetUsers: "",
  assistantRole: "customer_service",
  assistantRoleCustom: "",
  enabledTasks: ["answer_questions"],
  industry: "",
  botType: "universal-assistant",
  leadNotificationEmail: "",
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
  test("uses universal assistant fields in the normal create flow", () => {
    render(
      <SiteForm
        form={baseForm}
        tenantOptions={[{ id: "t-default", name: "Interner Mandant" }]}
        industryOptions={templates}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Unternehmensbeschreibung")).toBeInTheDocument();
    expect(screen.getByLabelText("Zielgruppe / Nutzer")).toBeInTheDocument();
    expect(screen.getByLabelText("KI-Mitarbeiter-Rolle")).toBeInTheDocument();
    expect(screen.getByText("Hauptaufgaben der KI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kunde anlegen" })).toBeInTheDocument();

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
