export type LeadPayload = {
  name: string;
  email: string;
  phone?: string;
  message?: string;
};

export type LeadSubmissionState = "idle" | "submitting" | "success" | "error";
