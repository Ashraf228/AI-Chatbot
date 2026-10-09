import { forwardSiteRuntimeGrantRequest } from "@/lib/site-runtime-grant-transport";

export async function GET(
  request: Request,
  context: { params: Promise<{ tenantId: string; siteId: string; grantId: string }> },
) {
  return forwardSiteRuntimeGrantRequest(request, "status", await context.params);
}
