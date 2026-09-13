import { forwardCustomerKnowledgeRequest } from "@/lib/customer-knowledge-transport";

export async function GET(
  request: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const params = await context.params;
  return forwardCustomerKnowledgeRequest(request, "list", params);
}
