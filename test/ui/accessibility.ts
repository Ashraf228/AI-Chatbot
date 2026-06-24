import axe from "axe-core";
import { expect } from "vitest";

export async function expectNoCriticalOrSeriousAxeViolations(container: Element) {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
    },
  });
  const blockingViolations = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious"
  );
  expect(blockingViolations).toEqual([]);
}
