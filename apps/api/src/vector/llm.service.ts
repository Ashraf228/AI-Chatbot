import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class LlmService {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async answer(system: string, user: string) {
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    const start = Date.now();

    const res = await this.client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const latencyMs = Date.now() - start;

    const text = res.choices[0]?.message?.content ?? '';

    // ✅ OpenAI Usage auslesen
    const usage = res.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    return {
      text,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      model,
      latencyMs,
    };
  }

  async streamAnswer(
    system: string,
    user: string,
    onChunk: (chunk: string) => Promise<void> | void,
  ) {
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const start = Date.now();

    const stream = await this.client.chat.completions.create({
      model,
      temperature: 0.2,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    let text = '';

    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content ?? '';
      if (!delta) {
        continue;
      }

      text += delta;
      await onChunk(delta);
    }

    return {
      text,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      model,
      latencyMs: Date.now() - start,
    };
  }
}
