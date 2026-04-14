export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';

export class WidgetLeadEntity {
  id!: string;
  siteId!: string;
  sessionId!: string;
  name!: string;
  email!: string;
  phone?: string;
  message?: string;
  status!: LeadStatus;
  createdAt!: string;
}
