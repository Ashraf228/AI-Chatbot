import { fetchEvaluationBackend, passThroughEvaluationResponse, requireViewerSession } from "@/lib/evaluation-server";

export async function POST(req: Request) {
  const auth = await requireViewerSession();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const response = await fetchEvaluationBackend(auth.session, "/chat/ticket/handoff/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId: body?.conversationId }),
  });
  const data = await response.json().catch(() => ({ message: "Demo-Übergabestatus konnte nicht geladen werden." }));
  return passThroughEvaluationResponse(response, data);
}

export async function GET(req: Request) {
  const auth = await requireViewerSession();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId") || "";
  const response = await fetchEvaluationBackend(auth.session, `/chat/ticket/handoff/status?conversationId=${encodeURIComponent(conversationId)}`);
  const data = await response.json().catch(() => ({ message: "Demo-Übergabestatus konnte nicht geladen werden." }));
  return passThroughEvaluationResponse(response, data);
}
