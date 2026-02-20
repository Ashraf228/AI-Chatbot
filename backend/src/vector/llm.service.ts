import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class LlmService {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async answer(system: string, user: string) {
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const res = await this.client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return res.choices[0]?.message?.content ?? '';
  }
}