import { describe, expect, test } from "vitest";

import { buildUniversalSiteConfig } from "../lib/site-create-config";

describe("buildUniversalSiteConfig", () => {
  test("creates a neutral assistant profile without enabling admin test flags", () => {
    const config = buildUniversalSiteConfig({
      customerName: "Musterkunde",
      businessDescription: "Kommunale Software und Supportprozesse",
      targetUsers: "Kommunen, interne Teams",
      assistantRole: "support",
      assistantRoleCustom: "",
      enabledTasks: ["answer_questions", "support", "prepare_handoff"],
      industry: "",
      botType: "",
      leadNotificationEmail: "",
    });

    expect(config.industry).toBe("generic");
    expect(config.botType).toBe("universal-assistant");
    expect(config.assistantProfile).toMatchObject({
      profileKey: "universal-assistant",
      profileVersion: 1,
      assistantName: "Musterkunde Assistent",
      role: "Support-Mitarbeiter",
      businessDescription: "Kommunale Software und Supportprozesse",
      targetUsers: ["Kommunen", "interne Teams"],
      tone: "professional",
      answerStyle: "concise",
      knowledgeMode: "flexible",
    });
    expect(config.enabledTasks).toEqual(["answer_questions", "support", "prepare_handoff"]);
    expect(config.conversationEngine).toEqual({
      previewEnabled: false,
      compareEnabled: false,
      responsePreviewEnabled: false,
      knowledgePreviewEnabled: false,
      adminTestOnly: true,
    });
  });

  test("keeps legacy values when they are explicitly selected", () => {
    const config = buildUniversalSiteConfig({
      customerName: "Altbetrieb",
      businessDescription: "",
      targetUsers: "",
      assistantRole: "custom",
      assistantRoleCustom: "Technischer Vorqualifizierer",
      enabledTasks: ["collect_requests"],
      industry: "local-service-first-contact",
      botType: "handwerker-first-contact",
      leadNotificationEmail: "info@example.test",
    });

    expect(config.industry).toBe("local-service-first-contact");
    expect(config.botType).toBe("handwerker-first-contact");
    expect(config.leadCaptureEnabled).toBe(true);
    expect(config.leadNotificationEmail).toBe("info@example.test");
    expect(config.assistantProfile.role).toBe("Technischer Vorqualifizierer");
  });
});
