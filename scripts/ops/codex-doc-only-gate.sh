#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/ops/codex-doc-only-gate.sh [--base <ref>] [--head <ref>]
EOF
}

cli_base_ref=""
cli_head_ref=""

while (($# > 0)); do
  case "$1" in
    --base)
      shift
      cli_base_ref="${1:-}"
      ;;
    --head)
      shift
      cli_head_ref="${1:-}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

scripts/ops/codex-preflight.sh

tmp_worktree_paths="$(mktemp)"
tmp_ref_paths="$(mktemp)"
tmp_changed_paths="$(mktemp)"
trap 'rm -f "$tmp_worktree_paths" "$tmp_ref_paths" "$tmp_changed_paths"' EXIT

{
  git diff --name-only
  git diff --cached --name-only
  git ls-files --others --exclude-standard
} | awk 'NF' | sort -u >"$tmp_worktree_paths"

env_base_ref="${CODEX_DIFF_BASE:-}"
env_head_ref="${CODEX_DIFF_HEAD:-}"

effective_base_ref=""
effective_head_ref=""
effective_merge_base=""
effective_context_source=""

populate_ref_paths() {
  local candidate_base_ref="$1"
  local candidate_head_ref="$2"

  git rev-parse --verify "${candidate_base_ref}^{commit}" >/dev/null
  git rev-parse --verify "${candidate_head_ref}^{commit}" >/dev/null

  effective_merge_base="$(git merge-base "$candidate_base_ref" "$candidate_head_ref")"
  git diff --name-only "$effective_merge_base..$candidate_head_ref" | awk 'NF' | sort -u >"$tmp_ref_paths"
  effective_base_ref="$candidate_base_ref"
  effective_head_ref="$candidate_head_ref"
}

if [[ -n "$cli_head_ref" && -z "$cli_base_ref" ]]; then
  echo "[doc-only-gate] FAIL: --head requires --base" >&2
  exit 1
fi

if [[ -n "$env_head_ref" && -z "$env_base_ref" && -z "$cli_base_ref" ]]; then
  echo "[doc-only-gate] FAIL: CODEX_DIFF_HEAD requires CODEX_DIFF_BASE" >&2
  exit 1
fi

if [[ -n "$cli_base_ref" ]]; then
  populate_ref_paths "$cli_base_ref" "${cli_head_ref:-HEAD}"
  effective_context_source="cli"
elif [[ -n "$env_base_ref" ]]; then
  populate_ref_paths "$env_base_ref" "${env_head_ref:-HEAD}"
  effective_context_source="env"
elif git rev-parse --verify "origin/main^{commit}" >/dev/null 2>&1; then
  populate_ref_paths "origin/main" "HEAD"
  if [[ -s "$tmp_ref_paths" ]]; then
    effective_context_source="auto"
  else
    : >"$tmp_ref_paths"
    effective_base_ref=""
    effective_head_ref=""
    effective_merge_base=""
  fi
fi

cat "$tmp_worktree_paths" "$tmp_ref_paths" | awk 'NF' | sort -u >"$tmp_changed_paths"

if [[ -s "$tmp_changed_paths" ]]; then
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    case "$path" in
      docs/*|AGENTS.md)
        ;;
      *)
        echo "[doc-only-gate] FAIL: non-doc path changed: $path" >&2
        exit 1
        ;;
    esac
  done <"$tmp_changed_paths"
fi

if [[ -n "$effective_context_source" ]]; then
  echo "[doc-only-gate] using ${effective_context_source} diff context: ${effective_merge_base}..${effective_head_ref}"
  scripts/ops/codex-sensitive-scan.sh --base "$effective_merge_base" --head "$effective_head_ref"
fi

if [[ -s "$tmp_worktree_paths" ]]; then
  scripts/ops/codex-sensitive-scan.sh
elif [[ -z "$effective_context_source" ]]; then
  scripts/ops/codex-sensitive-scan.sh
fi

npm run security:audit:production-contexts
npm run security:check-authorization-matrix
npm run test:security-boundaries
git diff --check

echo "[doc-only-gate] PASS"
