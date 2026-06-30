export type UniversalSiteFormConfigInput = {
  customerName: string;
  businessDescription: string;
  targetUsers: string;
  assistantRole: string;
  assistantRoleCustom: string;
  enabledTasks: string[];
  industry: string;
  botType: string;
  leadNotificationEmail: string;
};

export function buildUniversalSiteConfig(input: UniversalSiteFormConfigInput) {
  const enabledTasks = input.enabledTasks.length > 0 ? input.enabledTasks : ["answer_questions"];
  const leadNotificationEmail = input.leadNotificationEmail.trim();

  return {
    industry: input.industry || "generic",
    botType: input.botType || "universal-assistant",
    leadCaptureEnabled: enabledTasks.includes("collect_requests"),
    leadNotificationEmail: leadNotificationEmail || undefined,
    assistantProfile: {
      profileKey: "universal-assistant",
      profileVersion: 1,
      assistantName: `${input.customerName.trim() || "KI"} Assistent`,
      role:
        input.assistantRole === "custom"
          ? input.assistantRoleCustom.trim() || "Individuell"
          : formatAssistantRole(input.assistantRole),
      businessDescription: input.businessDescription.trim(),
      targetUsers: splitList(input.targetUsers),
      tone: "professional",
      answerStyle: "concise",
      knowledgeMode: "flexible",
    },
    enabledTasks,
    conversationEngine: {
      previewEnabled: false,
      compareEnabled: false,
      responsePreviewEnabled: false,
      knowledgePreviewEnabled: false,
      adminTestOnly: true,
    },
  };
}

export function formatAssistantRole(role: string) {
  if (role === "support") return "Support-Mitarbeiter";
  if (role === "product_advisor") return "Produktberater";
  if (role === "reception") return "Empfang / Erstkontakt";
  if (role === "knowledge_assistant") return "Interner Wissensassistent";
  return "Kundenservice-Mitarbeiter";
}

function splitList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
