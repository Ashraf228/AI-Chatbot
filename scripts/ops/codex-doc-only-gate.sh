#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

scripts/ops/codex-preflight.sh

changed_paths="$(
  {
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  } | awk 'NF' | sort -u
)"

if [[ -n "$changed_paths" ]]; then
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
  done <<<"$changed_paths"
fi

scripts/ops/codex-sensitive-scan.sh
npm run security:audit:production-contexts
npm run security:check-authorization-matrix
npm run test:security-boundaries
git diff --check

echo "[doc-only-gate] PASS"
