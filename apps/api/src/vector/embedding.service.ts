import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async embed(text: string): Promise<number[]> {
    const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
    const res = await this.client.embeddings.create({ model, input: text });
    return res.data[0].embedding as unknown as number[];
  }
}