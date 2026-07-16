#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/ops/codex-preflight.sh [--require-clean]
EOF
}

require_clean=0

while (($# > 0)); do
  case "$1" in
    --require-clean)
      require_clean=1
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

echo "[preflight] repo root: $repo_root"

test -f AGENTS.md || {
  echo "[preflight] FAIL: AGENTS.md missing" >&2
  exit 1
}

test -d docs/operations || {
  echo "[preflight] FAIL: docs/operations missing" >&2
  exit 1
}

required_docs=(
  docs/operations/codex-masterauftrag.md
  docs/operations/codex-production-gates.md
  docs/operations/codex-reporting-format.md
  docs/operations/codex-runbook.md
  docs/operations/codex-stop-criteria.md
  docs/operations/codex-test-matrix.md
)

for path in "${required_docs[@]}"; do
  test -f "$path" || {
    echo "[preflight] FAIL: missing $path" >&2
    exit 1
  }
done

if ((require_clean)); then
  if [[ -n "$(git status --short)" ]]; then
    echo "[preflight] FAIL: working tree is not clean" >&2
    git status --short
    exit 1
  fi
fi

echo "[preflight] branch: $(git branch --show-current || true)"
echo "[preflight] head: $(git rev-parse HEAD)"
echo "[preflight] PASS"
