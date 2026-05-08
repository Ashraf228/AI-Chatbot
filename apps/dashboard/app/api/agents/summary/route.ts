import { NextResponse } from "next/server";
import { fetchDashboardBackend } from "@/lib/dashboard-api";
import { requireSession } from "@/lib/require-auth";

type SiteRow = {
  id: string;
  name: string;
  site_key: string;
};

type AgentRun = {
  id: string;
  siteId: string;
  agentKey: string;
  agentLabel: string;
  triggerSource: string;
  status: string;
  inputSummary: string | null;
  outputSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export async function GET() {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const sitesRes = await fetchDashboardBackend("/admin/sites", {
    method: "GET",
    session: auth.session,
    cache: "no-store",
  });

  const sitesText = await sitesRes.text();
  const sitesData = JSON.parse(sitesText || "[]");

  if (!sitesRes.ok) {
    return new NextResponse(sitesText || "{}", {
      status: sitesRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sites = Array.isArray(sitesData) ? (sitesData as SiteRow[]) : [];
  const runResults = await Promise.all(
    sites.map(async (site) => {
      const response = await fetchDashboardBackend(`/admin/agents/${encodeURIComponent(site.id)}`, {
        method: "GET",
        session: auth.session,
        cache: "no-store",
      });

      const text = await response.text();
      const data = JSON.parse(text || "{}");

      return {
        site,
        ok: response.ok,
        runs: Array.isArray(data?.runs) ? (data.runs as AgentRun[]) : [],
      };
    }),
  );

  const runs = runResults.flatMap((entry) =>
    entry.runs.map((run) => ({
      ...run,
      siteName: entry.site.name,
      siteKey: entry.site.site_key,
    })),
  );

  runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const summary = {
    totalRuns: runs.length,
    completedRuns: runs.filter((run) => run.status === "completed").length,
    failedRuns: runs.filter((run) => run.status === "failed").length,
    processingRuns: runs.filter((run) => run.status === "processing").length,
    recentRuns: runs.slice(0, 8),
  };

  return NextResponse.json(summary);
}
