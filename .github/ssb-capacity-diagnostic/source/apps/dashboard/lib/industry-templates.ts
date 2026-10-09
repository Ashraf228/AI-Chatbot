export type SiteModulePatch = {
  key: string;
  isEnabled: boolean;
  config?: Record<string, unknown>;
};

export type BrandingDefaults = {
  brandColor: string;
  accentColor: string;
  fontFamily: "system" | "inter" | "avenir" | "georgia" | "times" | "trebuchet" | "verdana" | "monospace";
  botName?: string;
};

export type IndustryTemplate = {
  key: string;
  version: number;
  label: string;
  description?: string;
  setupGoal: "lead_capture" | "support" | "product_advice" | "appointments";
  botType?: string;
  welcomeMessage: string;
  systemPrompt: string;
  tone?: "professional" | "friendly" | "consultative";
  ctaText?: string;
  launcherLabel?: string;
  recommendedQuestions: Record<string, string[]>;
  topTestQuestions?: string[];
  reportKpis?: string[];
  brandingDefaults?: BrandingDefaults;
  modules: SiteModulePatch[];
};

export function templatesByKey(templates: IndustryTemplate[]) {
  return Object.fromEntries(templates.map((template) => [template.key, template]));
}
