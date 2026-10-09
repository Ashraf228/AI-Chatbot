import { forwardSiteRuntimeLlmGrantRequest } from "@/lib/site-runtime-grant-transport";

export async function POST(
  request: Request,
  context: { params: Promise<{ tenantId: string; siteId: string; grantId: string }> },
) {
  return forwardSiteRuntimeLlmGrantRequest(request, "revoke", await context.params);
}
