import { fetchEvaluationBackend, passThroughEvaluationResponse, requireViewerSession } from "@/lib/evaluation-server";

export async function POST(req: Request) {
  const auth = await requireViewerSession();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const response = await fetchEvaluationBackend(auth.session, "/chat/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({ message: "Evaluation-Dialog konnte nicht gestartet werden." }));
  return passThroughEvaluationResponse(response, data);
}
