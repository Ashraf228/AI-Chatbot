#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

contexts=(
  "apps/api"
  "apps/dashboard"
  "apps/widget"
  "apps/reporter"
  "packages/widget-sdk"
)

echo "[audit] checking documented audit exceptions"
node -e '
const fs = require("node:fs");
const text = fs.readFileSync("docs/security/audit-exceptions.md", "utf8");
if (text.includes("<TODO") || /Owner:\s*TODO/i.test(text)) {
  console.error("FAIL audit exceptions contain TODO owner");
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const expired = [...text.matchAll(/Expires:\s*(\d{4}-\d{2}-\d{2})/g)]
  .map((match) => match[1])
  .filter((date) => date < today);
if (expired.length) {
  console.error(`FAIL expired audit exception(s): ${expired.join(", ")}`);
  process.exit(1);
}
console.log("PASS audit exceptions are current");
'

echo "[audit] root workspace blocks high and critical production findings"
npm audit --omit=dev --audit-level=high
echo "PASS root production audit has no high or critical findings"

for context in "${contexts[@]}"; do
  echo "[audit] ${context}"
  temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/ai-chatbot-audit-${context//\//-}.XXXXXX")"
  trap 'rm -rf "${temp_dir}"' EXIT
  cp "${ROOT_DIR}/${context}/package.json" "${ROOT_DIR}/${context}/package-lock.json" "${temp_dir}/"
  (
    cd "${temp_dir}"
    npm ci --workspaces=false --ignore-scripts --audit=false --fund=false
    npm audit --omit=dev --workspaces=false
  )
  rm -rf "${temp_dir}"
  trap - EXIT
  echo "PASS ${context}"
done
