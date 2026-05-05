export type SiteModulePatch = {
  key: string;
  isEnabled: boolean;
  config?: Record<string, unknown>;
};

export type IndustryTemplate = {
  key: string;
  label: string;
  setupGoal: "lead_capture" | "support" | "product_advice" | "appointments";
  welcomeMessage: string;
  systemPrompt: string;
  recommendedQuestions: Record<string, string[]>;
  modules: SiteModulePatch[];
};

export function templatesByKey(templates: IndustryTemplate[]) {
  return Object.fromEntries(templates.map((template) => [template.key, template]));
}
