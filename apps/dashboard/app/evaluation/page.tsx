import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/auth";
import { fetchEvaluationBackend } from "@/lib/evaluation-server";
import { EvaluationWorkspace } from "./EvaluationWorkspace";

export default async function EvaluationPage() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "viewer") {
    redirect("/sites");
  }

  const response = await fetchEvaluationBackend(session, "/context", { method: "GET" });
  if (!response.ok) {
    redirect("/login");
  }
  const context = await response.json();
  return <EvaluationWorkspace context={context} />;
}
