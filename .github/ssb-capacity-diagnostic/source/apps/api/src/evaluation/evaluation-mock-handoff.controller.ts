import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EvaluationHandoffService } from './evaluation-handoff.service';

@Controller('internal/evaluation/mock-handoff')
export class EvaluationMockHandoffController {
  constructor(private readonly handoff: EvaluationHandoffService) {}

  @Post('v1')
  async receive(@Req() req: Request & { body?: Buffer }) {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    return this.handoff.receiveMockHandoff(req.headers, rawBody);
  }
}
