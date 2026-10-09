import { describe, expect, test } from "vitest";

import { buildUniversalSiteConfig } from "../lib/site-create-config";

describe("buildUniversalSiteConfig", () => {
  test("creates a metadata-only site config and leaves agent details for setup", () => {
    const config = buildUniversalSiteConfig({
      customerName: "Musterkunde",
      industry: "",
      botType: "",
    });

    expect(config.industry).toBe("generic");
    expect(config.botType).toBe("universal-assistant");
    expect(config).not.toHaveProperty("assistantProfile");
    expect(config).not.toHaveProperty("enabledTasks");
    expect(config).not.toHaveProperty("leadCaptureEnabled");
    expect(config).not.toHaveProperty("leadNotificationEmail");
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
      industry: "local-service-first-contact",
      botType: "handwerker-first-contact",
    });

    expect(config.industry).toBe("local-service-first-contact");
    expect(config.botType).toBe("handwerker-first-contact");
    expect(config).not.toHaveProperty("assistantProfile");
    expect(config).not.toHaveProperty("enabledTasks");
  });
});
