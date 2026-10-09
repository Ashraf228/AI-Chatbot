import { fetchEvaluationBackend, passThroughEvaluationResponse, requireViewerSession } from "@/lib/evaluation-server";

export async function GET() {
  const auth = await requireViewerSession();
  if (auth.response) return auth.response;

  const response = await fetchEvaluationBackend(auth.session, "/context", { method: "GET" });
  const data = await response.json().catch(() => ({ message: "Evaluation nicht verfuegbar." }));
  return passThroughEvaluationResponse(response, data);
}
