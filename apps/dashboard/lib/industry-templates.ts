export type SiteModulePatch = {
  key: string;
  isEnabled: boolean;
  config?: Record<string, unknown>;
};

export type IndustryTemplate = {
  key: string;
  version: number;
  label: string;
  setupGoal: "lead_capture" | "support" | "product_advice" | "appointments";
  welcomeMessage: string;
  systemPrompt: string;
  tone?: "professional" | "friendly" | "consultative";
  ctaText?: string;
  recommendedQuestions: Record<string, string[]>;
  topTestQuestions?: string[];
  reportKpis?: string[];
  modules: SiteModulePatch[];
};

export function templatesByKey(templates: IndustryTemplate[]) {
  return Object.fromEntries(templates.map((template) => [template.key, template]));
}
