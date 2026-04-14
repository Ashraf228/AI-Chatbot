export type ReportSubscriptionFrequency = 'weekly' | 'monthly';

export class ReportSubscriptionEntity {
  id!: string;
  siteId!: string;
  recipientEmail!: string;
  frequency!: ReportSubscriptionFrequency;
  isEnabled!: boolean;
}
