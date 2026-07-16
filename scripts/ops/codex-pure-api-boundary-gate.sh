#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/codex-pure-api-boundary-gate.sh \
    --focused-test "<command>" \
    [--regression-test "<command>"]
EOF
}

focused_test=""
declare -a regression_tests=()

while (($# > 0)); do
  case "$1" in
    --focused-test)
      shift
      focused_test="${1:-}"
      ;;
    --regression-test)
      shift
      regression_tests+=("${1:-}")
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

if [[ -z "$focused_test" ]]; then
  echo "[pure-api-boundary-gate] FAIL: --focused-test is required" >&2
  usage >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

scripts/ops/codex-preflight.sh
scripts/ops/codex-sensitive-scan.sh

npm run check:api
npm run build:api
bash -lc "$focused_test"

for cmd in "${regression_tests[@]}"; do
  bash -lc "$cmd"
done

npm run test:smoke --workspace=apps/api
npm run check:all
npm run security:audit:production-contexts
npm run security:check-authorization-matrix
npm run test:security-boundaries
git diff --check

echo "[pure-api-boundary-gate] PASS"
