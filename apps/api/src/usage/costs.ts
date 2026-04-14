export function estimateOpenAICost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const { model, inputTokens, outputTokens } = params;

  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4.1-mini': {
      input: 0.0000004,   // € pro Token
      output: 0.0000016,
    },
  };

  const p = pricing[model] || pricing['gpt-4.1-mini'];

  const cost =
    inputTokens * p.input +
    outputTokens * p.output;

  return Number(cost.toFixed(6));
}