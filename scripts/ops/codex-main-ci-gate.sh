#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_PASS=0
readonly EXIT_WAITING=20
readonly EXIT_FAILED=21
readonly EXIT_UNAVAILABLE=22
readonly EXIT_USAGE=64

readonly DEFAULT_BRANCH="main"
readonly DEFAULT_EVENT="push"
readonly DEFAULT_REQUIRED_CHECKS_JSON='["Source gate","Security audit","Docker build","Security PostgreSQL isolation"]'

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/codex-main-ci-gate.sh --sha <commit> [options]

Options:
  --sha <commit>                Exact commit SHA to evaluate. Required.
  --repo <owner/repo>           Repository slug. Defaults to origin remote.
  --branch <branch>             Branch to treat as main-push proof target. Default: main.
  --event <event>               Workflow event to require. Default: push.
  --check-runs-json <file>      Optional fixture JSON for GitHub check runs.
  --workflow-runs-json <file>   Optional fixture JSON for GitHub workflow runs.
  --workflow-jobs-json <file>   Optional fixture JSON for workflow jobs.
  --help                        Show this help.

Decisions:
  pass         exit 0
  waiting      exit 20
  failed       exit 21
  unavailable  exit 22

Behavior:
  - Evaluates only the exact SHA.
  - Does not count PR-head CI as Main-CI proof.
  - Prefers GitHub Check Runs and main push workflow runs.
  - Never triggers workflows or mutates GitHub state.
EOF
}

die_usage() {
  echo "$1" >&2
  usage >&2
  exit "$EXIT_USAGE"
}

have_command() {
  command -v "$1" >/dev/null 2>&1
}

infer_repo_from_origin() {
  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"

  case "$remote_url" in
    git@github.com:*)
      remote_url="${remote_url#git@github.com:}"
      remote_url="${remote_url%.git}"
      printf '%s\n' "$remote_url"
      ;;
    https://github.com/*)
      remote_url="${remote_url#https://github.com/}"
      remote_url="${remote_url%.git}"
      printf '%s\n' "$remote_url"
      ;;
    http://github.com/*)
      remote_url="${remote_url#http://github.com/}"
      remote_url="${remote_url%.git}"
      printf '%s\n' "$remote_url"
      ;;
    *)
      return 1
      ;;
  esac
}

fetch_json_with_gh() {
  local output_file="$1"
  shift
  gh api -H "Accept: application/vnd.github+json" "$@" >"$output_file"
}

sha=""
repo=""
branch="$DEFAULT_BRANCH"
event="$DEFAULT_EVENT"
check_runs_json=""
workflow_runs_json=""
workflow_jobs_json=""

while (($# > 0)); do
  case "$1" in
    --sha)
      shift
      sha="${1:-}"
      ;;
    --repo)
      shift
      repo="${1:-}"
      ;;
    --branch)
      shift
      branch="${1:-}"
      ;;
    --event)
      shift
      event="${1:-}"
      ;;
    --check-runs-json)
      shift
      check_runs_json="${1:-}"
      ;;
    --workflow-runs-json)
      shift
      workflow_runs_json="${1:-}"
      ;;
    --workflow-jobs-json)
      shift
      workflow_jobs_json="${1:-}"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die_usage "Unknown argument: $1"
      ;;
  esac
  shift
done

[[ -n "$sha" ]] || die_usage "--sha is required"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

if [[ -z "$repo" ]]; then
  repo="$(infer_repo_from_origin || true)"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

check_runs_file="$tmp_dir/check-runs.json"
workflow_runs_file="$tmp_dir/workflow-runs.json"
workflow_jobs_file="$tmp_dir/workflow-jobs.json"
summary_file="$tmp_dir/summary.json"

gh_state="authenticated"
gh_reason=""

if [[ -n "$check_runs_json" ]]; then
  cp "$check_runs_json" "$check_runs_file"
fi

if [[ -n "$workflow_runs_json" ]]; then
  cp "$workflow_runs_json" "$workflow_runs_file"
fi

if [[ -n "$workflow_jobs_json" ]]; then
  cp "$workflow_jobs_json" "$workflow_jobs_file"
fi

if [[ -z "$check_runs_json" || -z "$workflow_runs_json" ]]; then
  if ! have_command gh; then
    gh_state="missing"
    gh_reason="gh CLI not available"
  elif ! gh auth status >/dev/null 2>&1; then
    gh_state="unauthenticated"
    gh_reason="gh CLI not authenticated"
  elif [[ -z "$repo" ]]; then
    gh_state="unavailable"
    gh_reason="repository slug unavailable"
  fi
fi

commit_on_branch="unknown"
if git rev-parse --verify "origin/$branch^{commit}" >/dev/null 2>&1 && git cat-file -e "$sha^{commit}" 2>/dev/null; then
  if git merge-base --is-ancestor "$sha" "origin/$branch"; then
    commit_on_branch="yes"
  else
    commit_on_branch="no"
  fi
fi

if [[ -z "$check_runs_json" && "$gh_state" == "authenticated" ]]; then
  if ! fetch_json_with_gh "$check_runs_file" "repos/$repo/commits/$sha/check-runs?per_page=100"; then
    gh_state="unavailable"
    gh_reason="failed to fetch check runs"
  fi
fi

if [[ -z "$workflow_runs_json" && "$gh_state" == "authenticated" ]]; then
  if ! fetch_json_with_gh "$workflow_runs_file" "repos/$repo/actions/runs" -f head_sha="$sha" -f branch="$branch" -f event="$event" -F per_page=20; then
    gh_state="unavailable"
    gh_reason="failed to fetch workflow runs"
  fi
fi

if [[ -z "$workflow_runs_json" && -s "$workflow_runs_file" && -z "$workflow_jobs_json" && "$gh_state" == "authenticated" ]]; then
  workflow_run_id="$(
    node -e '
      const fs = require("fs");
      const file = process.argv[1];
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const runs = Array.isArray(raw.workflow_runs) ? raw.workflow_runs : [];
      const run = runs[0];
      process.stdout.write(run && run.id ? String(run.id) : "");
    ' "$workflow_runs_file"
  )"

  if [[ -n "$workflow_run_id" ]]; then
    if ! fetch_json_with_gh "$workflow_jobs_file" "repos/$repo/actions/runs/$workflow_run_id/jobs?per_page=100"; then
      gh_reason="failed to fetch workflow jobs"
    fi
  fi
fi

REQUIRED_CHECKS_JSON="$DEFAULT_REQUIRED_CHECKS_JSON" \
TARGET_SHA="$sha" \
TARGET_REPO="$repo" \
TARGET_BRANCH="$branch" \
TARGET_EVENT="$event" \
COMMIT_ON_BRANCH="$commit_on_branch" \
GH_STATE="$gh_state" \
GH_REASON="$gh_reason" \
CHECK_RUNS_FILE="$check_runs_file" \
WORKFLOW_RUNS_FILE="$workflow_runs_file" \
WORKFLOW_JOBS_FILE="$workflow_jobs_file" \
node >"$summary_file" <<'NODE'
const fs = require("fs");

function readJson(filePath) {
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return null;
  return JSON.parse(content);
}

function normalizeRequiredChecks(required, items, nameField) {
  const byName = new Map();
  for (const item of items) {
    if (item && item[nameField]) byName.set(item[nameField], item);
  }

  const result = [];
  let hasFailed = false;
  let hasWaiting = false;
  let allPass = true;
  let presentCount = 0;

  for (const name of required) {
    const item = byName.get(name);
    if (!item) {
      result.push({ name, present: false, status: "missing", conclusion: "", decision: "missing" });
      allPass = false;
      continue;
    }

    presentCount += 1;
    const status = item.status || "unknown";
    const conclusion = item.conclusion || "";
    let decision = "missing";

    if (status !== "completed") {
      decision = "waiting";
      hasWaiting = true;
      allPass = false;
    } else if (conclusion === "success") {
      decision = "pass";
    } else if (["queued", "in_progress", "pending", "requested", "waiting"].includes(status)) {
      decision = "waiting";
      hasWaiting = true;
      allPass = false;
    } else {
      decision = "failed";
      hasFailed = true;
      allPass = false;
    }

    result.push({
      name,
      present: true,
      status,
      conclusion,
      decision,
    });
  }

  let aggregate = "missing";
  if (hasFailed) {
    aggregate = "failed";
  } else if (hasWaiting) {
    aggregate = "waiting";
  } else if (allPass && required.length > 0) {
    aggregate = "pass";
  } else if (presentCount > 0) {
    aggregate = "partial";
  }

  return {
    aggregate,
    presentCount,
    foundAny: items.length > 0,
    required: result,
  };
}

function summarizeWorkflowRuns(rawRuns) {
  const runs = rawRuns && Array.isArray(rawRuns.workflow_runs) ? rawRuns.workflow_runs : [];
  const chosen = runs[0] || null;
  let aggregate = "missing";

  if (chosen) {
    if (chosen.status && chosen.status !== "completed") {
      aggregate = "waiting";
    } else if (chosen.conclusion === "success") {
      aggregate = "pass_candidate";
    } else if (["failure", "cancelled", "timed_out", "action_required", "stale"].includes(chosen.conclusion || "")) {
      aggregate = "failed";
    } else {
      aggregate = "partial";
    }
  }

  return {
    foundAny: runs.length > 0,
    count: runs.length,
    aggregate,
    chosen: chosen
      ? {
          id: chosen.id || null,
          name: chosen.name || "",
          status: chosen.status || "",
          conclusion: chosen.conclusion || "",
          url: chosen.html_url || (chosen.id ? `https://github.com/${process.env.TARGET_REPO}/actions/runs/${chosen.id}` : ""),
          head_sha: chosen.head_sha || "",
          event: chosen.event || "",
        }
      : null,
  };
}

const requiredChecks = JSON.parse(process.env.REQUIRED_CHECKS_JSON || "[]");
const checkRunsRaw = readJson(process.env.CHECK_RUNS_FILE || "");
const workflowRunsRaw = readJson(process.env.WORKFLOW_RUNS_FILE || "");
const workflowJobsRaw = readJson(process.env.WORKFLOW_JOBS_FILE || "");

const checkRuns = checkRunsRaw && Array.isArray(checkRunsRaw.check_runs) ? checkRunsRaw.check_runs : [];
const workflowJobs = workflowJobsRaw && Array.isArray(workflowJobsRaw.jobs) ? workflowJobsRaw.jobs : [];

const checkRunSummary = normalizeRequiredChecks(requiredChecks, checkRuns, "name");
const workflowRunSummary = summarizeWorkflowRuns(workflowRunsRaw);
const workflowJobSummary = normalizeRequiredChecks(requiredChecks, workflowJobs, "name");

let finalDecision = "unavailable";
let reason = process.env.GH_REASON || "";

if ((process.env.COMMIT_ON_BRANCH || "unknown") === "no") {
  finalDecision = "unavailable";
  reason = `target commit is not contained in origin/${process.env.TARGET_BRANCH}`;
} else if (checkRunSummary.aggregate === "failed") {
  finalDecision = "failed";
  reason = "required check run failed";
} else if (checkRunSummary.aggregate === "waiting") {
  finalDecision = "waiting";
  reason = "required check run still pending";
} else if (checkRunSummary.aggregate === "pass") {
  finalDecision = "pass";
  reason = "required check runs succeeded";
} else if (workflowRunSummary.aggregate === "failed") {
  finalDecision = "failed";
  reason = "main push workflow run failed";
} else if (workflowRunSummary.aggregate === "waiting") {
  finalDecision = "waiting";
  reason = "main push workflow run still pending";
} else if (workflowRunSummary.aggregate === "pass_candidate" && workflowJobSummary.aggregate === "pass") {
  finalDecision = "pass";
  reason = "main push workflow jobs succeeded";
} else if (workflowRunSummary.foundAny && workflowJobSummary.aggregate === "failed") {
  finalDecision = "failed";
  reason = "main push workflow required job failed";
} else if (workflowRunSummary.foundAny && workflowJobSummary.aggregate === "waiting") {
  finalDecision = "waiting";
  reason = "main push workflow required job still pending";
} else if (process.env.GH_STATE !== "authenticated" && !checkRunSummary.foundAny && !workflowRunSummary.foundAny) {
  finalDecision = "unavailable";
  reason = process.env.GH_REASON || "GitHub data unavailable";
} else {
  finalDecision = "unavailable";
  reason = "no exact Main-CI proof visible for required checks";
}

const exitCodes = {
  pass: 0,
  waiting: 20,
  failed: 21,
  unavailable: 22,
};

const summary = {
  repo: process.env.TARGET_REPO || "",
  sha: process.env.TARGET_SHA || "",
  branch: process.env.TARGET_BRANCH || "",
  event: process.env.TARGET_EVENT || "",
  commitOnBranch: process.env.COMMIT_ON_BRANCH || "unknown",
  ghState: process.env.GH_STATE || "unknown",
  ghReason: process.env.GH_REASON || "",
  checkRuns: checkRunSummary,
  workflowRuns: workflowRunSummary,
  workflowJobs: workflowJobSummary,
  finalDecision,
  reason,
  exitCode: exitCodes[finalDecision] ?? 22,
};

process.stdout.write(JSON.stringify(summary, null, 2));
NODE

node - "$summary_file" <<'NODE'
const fs = require("fs");
const summary = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

console.log(`repo: ${summary.repo || "unavailable"}`);
console.log(`target sha: ${summary.sha}`);
console.log(`branch: ${summary.branch}`);
console.log(`event: ${summary.event}`);
console.log(`commit on origin/${summary.branch}: ${summary.commitOnBranch}`);
console.log(`gh state: ${summary.ghState}${summary.ghReason ? ` (${summary.ghReason})` : ""}`);
console.log(`check runs found: ${summary.checkRuns.foundAny ? "yes" : "no"}`);
for (const check of summary.checkRuns.required) {
  console.log(`  check ${check.name}: ${check.decision} (status=${check.status}, conclusion=${check.conclusion || "-"})`);
}
console.log(`workflow runs found: ${summary.workflowRuns.foundAny ? "yes" : "no"}`);
if (summary.workflowRuns.chosen) {
  console.log(`  workflow run id: ${summary.workflowRuns.chosen.id}`);
  console.log(`  workflow run url: ${summary.workflowRuns.chosen.url}`);
  console.log(`  workflow run status: ${summary.workflowRuns.chosen.status}`);
  console.log(`  workflow run conclusion: ${summary.workflowRuns.chosen.conclusion || "-"}`);
  console.log(`  workflow run event: ${summary.workflowRuns.chosen.event || "-"}`);
  console.log(`  workflow run head_sha: ${summary.workflowRuns.chosen.head_sha || "-"}`);
}
for (const check of summary.workflowJobs.required) {
  console.log(`  workflow job ${check.name}: ${check.decision} (status=${check.status}, conclusion=${check.conclusion || "-"})`);
}
console.log(`final decision: ${summary.finalDecision}`);
console.log(`reason: ${summary.reason}`);
process.exit(summary.exitCode);
NODE
