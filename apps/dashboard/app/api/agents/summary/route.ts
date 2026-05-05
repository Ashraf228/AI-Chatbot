import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";

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
  const auth = await requireAuth();
  if (auth) return auth;

  const base = process.env.BACKEND_BASE_URL?.trim();
  const adminKey = process.env.ADMIN_KEY?.trim();

  if (!base) {
    return NextResponse.json({ message: "BACKEND_BASE_URL missing" }, { status: 500 });
  }

  if (!adminKey) {
    return NextResponse.json({ message: "ADMIN_KEY missing" }, { status: 500 });
  }

  const sitesRes = await fetch(`${base}/admin/sites`, {
    method: "GET",
    headers: {
      "X-ADMIN-KEY": adminKey,
    },
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
      const response = await fetch(`${base}/admin/agents/${encodeURIComponent(site.id)}`, {
        method: "GET",
        headers: {
          "X-ADMIN-KEY": adminKey,
        },
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
