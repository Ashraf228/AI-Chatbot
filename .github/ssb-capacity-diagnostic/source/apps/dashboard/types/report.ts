export type ReportSubscription = {
  id: string;
  recipientEmail: string;
  frequency: "weekly" | "monthly";
  isEnabled: boolean;
};
