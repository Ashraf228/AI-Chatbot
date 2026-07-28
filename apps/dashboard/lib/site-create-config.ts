export type UniversalSiteFormConfigInput = {
  customerName: string;
  industry: string;
  botType: string;
};

export function buildUniversalSiteConfig(input: UniversalSiteFormConfigInput) {
  return {
    industry: input.industry || "generic",
    botType: input.botType || "universal-assistant",
    conversationEngine: {
      previewEnabled: false,
      compareEnabled: false,
      responsePreviewEnabled: false,
      knowledgePreviewEnabled: false,
      adminTestOnly: true,
    },
  };
}
