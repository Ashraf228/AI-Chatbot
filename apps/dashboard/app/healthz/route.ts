import { NextResponse } from "next/server";

function getCommitSha() {
  const commit =
    process.env.APP_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APP_COMMIT_SHA ||
    process.env.BUILD_COMMIT ||
    process.env.GIT_COMMIT ||
    "";

  const normalizedCommit = commit.trim();
  return /^[0-9a-f]{7,64}$/i.test(normalizedCommit) ? normalizedCommit : "unknown";
}

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "dashboard",
    commit: getCommitSha(),
    buildTime: process.env.BUILD_DATE || "unknown",
  });
}
