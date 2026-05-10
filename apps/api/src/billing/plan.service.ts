import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { BillingPlan, PlanCode } from './billing.types';

type PlanRow = {
  id: string;
  code: PlanCode;
  name: string;
  description: string;
  monthly_price_cents: number | null;
  currency: string;
  limits: Record<string, unknown> | null;
  features: Record<string, unknown> | null;
  is_active: boolean;
};

@Injectable()
export class PlanService {
  constructor(private readonly db: PrismaService) {}

  async listPlans() {
    const res = await this.db.query<PlanRow>(
      `SELECT id, code, name, description, monthly_price_cents, currency, limits, features, is_active
       FROM plans
       WHERE is_active = true
       ORDER BY CASE code
         WHEN 'starter' THEN 1
         WHEN 'business' THEN 2
         WHEN 'agency' THEN 3
         WHEN 'enterprise' THEN 4
         ELSE 99
       END`,
    );
    return res.rows.map(mapPlanRow);
  }

  async getPlanByCode(code: string) {
    const res = await this.db.query<PlanRow>(
      `SELECT id, code, name, description, monthly_price_cents, currency, limits, features, is_active
       FROM plans
       WHERE code = $1 AND is_active = true
       LIMIT 1`,
      [code],
    );
    return res.rows[0] ? mapPlanRow(res.rows[0]) : null;
  }
}

function mapPlanRow(row: PlanRow): BillingPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    monthlyPriceCents: row.monthly_price_cents,
    currency: row.currency,
    limits: row.limits || null,
    features: row.features || {},
    isActive: row.is_active,
  };
}
