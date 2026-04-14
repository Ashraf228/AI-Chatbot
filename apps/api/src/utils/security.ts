export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid input");
  }

  if (input.length > 1000) {
    throw new Error("Input too long");
  }

  const lower = input.toLowerCase();

  const forbiddenPatterns = [
    "ignore previous instructions",
    "system prompt",
    "you are chatgpt",
    "act as",
    "override",
    "bypass",
    "developer mode",
  ];

  for (const pattern of forbiddenPatterns) {
    if (lower.includes(pattern)) {
      throw new Error("Blocked input pattern");
    }
  }

  return input.trim();
}

export function sanitizeOutput(output: string): string {
  if (!output) return "";

  const lower = output.toLowerCase();

  const forbidden = [
    "system prompt",
    "internal instruction",
    "admin key",
    "api key",
  ];

  for (const f of forbidden) {
    if (lower.includes(f)) {
      return "Antwort wurde aus Sicherheitsgründen blockiert.";
    }
  }

  return output;
}