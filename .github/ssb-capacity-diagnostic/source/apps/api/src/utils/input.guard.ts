export function validateUserInput(input: string) {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid input");
  }

  // Länge begrenzen
  if (input.length > 1000) {
    throw new Error("Input too long");
  }

  // Prompt Injection Patterns blocken
  const forbidden = [
    "ignore previous instructions",
    "system prompt",
    "you are chatgpt",
    "act as",
    "bypass",
    "override"
  ];

  const lower = input.toLowerCase();

  for (const f of forbidden) {
    if (lower.includes(f)) {
      throw new Error("Blocked input pattern");
    }
  }

  return input.trim();
}