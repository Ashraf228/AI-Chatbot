import { forwardCustomerKnowledgeRequest } from "@/lib/customer-knowledge-transport";

export async function POST(
  request: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const params = await context.params;
  return forwardCustomerKnowledgeRequest(request, "import", params);
}
