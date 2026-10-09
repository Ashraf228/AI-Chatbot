import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(process.cwd());

describe("widget deployment metadata", () => {
  test("widget image writes a safe version.json and serves it separately from public config", () => {
    const dockerfile = readFileSync(resolve(repoRoot, "apps/widget/Dockerfile"), "utf8");
    const nginxConfig = readFileSync(resolve(repoRoot, "apps/widget/nginx.conf"), "utf8");

    expect(dockerfile).toContain("ARG APP_COMMIT_SHA=unknown");
    expect(dockerfile).toContain("org.opencontainers.image.revision");
    expect(dockerfile).toContain("/usr/share/nginx/html/version.json");
    expect(dockerfile).toContain('"service":"widget"');
    expect(dockerfile).not.toMatch(/assistantProfileDebug|conversationEnginePreview|engineResponsePreview|responseQuality|knowledgeRetrieval|usedKnowledgeSources|groundingStatus/);

    expect(nginxConfig).toContain("location = /version.json");
    expect(nginxConfig).toContain("Cache-Control \"no-store\"");
  });
});
