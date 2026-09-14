import { forwardCustomerKnowledgeRequest } from "@/lib/customer-knowledge-transport";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ siteId: string; sourceId: string }> },
) {
  const params = await context.params;
  return forwardCustomerKnowledgeRequest(request, "delete", params);
}
