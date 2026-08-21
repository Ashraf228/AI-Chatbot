#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXCEPTION_JSON="${ROOT_DIR}/docs/security/audit-exceptions.production-contexts.json"

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

if [[ -f "${EXCEPTION_JSON}" ]]; then
  echo "[audit] checking machine-readable production-context exceptions"
  node -e '
const fs = require("node:fs");
const path = process.argv[1];
const today = new Date().toISOString().slice(0, 10);
const data = JSON.parse(fs.readFileSync(path, "utf8"));
if (!Array.isArray(data.exceptions)) {
  console.error("FAIL production-context exception file must contain an exceptions array");
  process.exit(1);
}
if (data.exceptions.length === 0) {
  console.log("PASS machine-readable production-context exceptions are current (no active exceptions)");
  process.exit(0);
}
for (const exception of data.exceptions) {
  const required = [
    "id",
    "status",
    "package",
    "acceptedSeverity",
    "dependencyPath",
    "affectedVersion",
    "context",
    "parentPath",
    "parentName",
    "parentVersion",
    "expiryDate",
    "ownerRole",
    "followUp",
  ];
  for (const key of required) {
    if (typeof exception[key] !== "string" || exception[key].trim() === "" || exception[key].includes("<")) {
      console.error(`FAIL production-context exception missing ${key}`);
      process.exit(1);
    }
  }
  if (exception.status !== "temporary_contextual_exception") {
    console.error(`FAIL production-context exception ${exception.id} has invalid status ${exception.status}`);
    process.exit(1);
  }
  if (exception.acceptedSeverity !== "high") {
    console.error(`FAIL production-context exception ${exception.id} must stay high-severity scoped`);
    process.exit(1);
  }
  if (!Array.isArray(exception.acceptedAdvisories) || exception.acceptedAdvisories.length === 0) {
    console.error(`FAIL production-context exception ${exception.id} must list accepted advisories`);
    process.exit(1);
  }
  if (!Array.isArray(exception.revalidationTriggers) || exception.revalidationTriggers.length === 0) {
    console.error(`FAIL production-context exception ${exception.id} must list revalidation triggers`);
    process.exit(1);
  }
  const restrictions = exception.scopeRestrictions;
  if (
    !restrictions ||
    restrictions.allowedUntilFix !== true ||
    restrictions.productionDeployAllowedWithoutFix !== false ||
    restrictions.customerDataAllowed !== false ||
    restrictions.dbReadOnlyAuditAllowed !== false ||
    restrictions.broadEnterpriseRolloutAllowed !== false
  ) {
    console.error(`FAIL production-context exception ${exception.id} has invalid scope restrictions`);
    process.exit(1);
  }
  if (exception.expiryDate < today) {
    console.error(`FAIL production-context exception ${exception.id} expired on ${exception.expiryDate}`);
    process.exit(1);
  }
}
console.log("PASS machine-readable production-context exceptions are current");
' "${EXCEPTION_JSON}"
fi

echo "[audit] root workspace aligns with production optional-dependency omission for high/critical findings"
audit_json="$(mktemp "${TMPDIR:-/tmp}/ai-chatbot-root-audit.XXXXXX.json")"
trap 'rm -f "${audit_json}"' EXIT
if npm audit --omit=dev --omit=optional --json > "${audit_json}"; then
  true
fi
node - "${audit_json}" "${ROOT_DIR}/package-lock.json" "${EXCEPTION_JSON}" <<'NODE'
const fs = require("node:fs");

const [auditPath, lockfilePath, exceptionPath] = process.argv.slice(2);

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function ghsaFromUrl(url) {
  const match = typeof url === "string" ? url.match(/(GHSA-[a-z0-9-]+)/i) : null;
  return match ? match[1].toUpperCase() : null;
}

const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
const lockfile = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
const packages = lockfile.packages || {};
const exceptions = fs.existsSync(exceptionPath)
  ? JSON.parse(fs.readFileSync(exceptionPath, "utf8")).exceptions || []
  : [];

const highOrCriticalFindings = Object.values(audit.vulnerabilities || {}).filter((finding) =>
  ["high", "critical"].includes(finding.severity),
);

if (highOrCriticalFindings.length === 0) {
  console.log("PASS root production audit has no high or critical findings after optional-dependency omission");
  process.exit(0);
}

const accepted = [];
const remaining = [];

for (const finding of highOrCriticalFindings) {
  if (finding.severity === "critical") {
    remaining.push({
      name: finding.name,
      severity: finding.severity,
      nodes: finding.nodes || [],
      reason: "critical findings cannot be accepted",
    });
    continue;
  }

  const advisoryIds = [
    ...new Set(
      (finding.via || [])
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ghsaFromUrl(entry.url))
        .filter(Boolean),
    ),
  ].sort();

  const match = exceptions.find((exception) => {
    const acceptedIds = [...exception.acceptedAdvisories].map((id) => id.toUpperCase()).sort();
    return (
      finding.name === exception.package &&
      finding.severity === exception.acceptedSeverity &&
      Array.isArray(finding.nodes) &&
      finding.nodes.length === 1 &&
      finding.nodes[0] === exception.dependencyPath &&
      advisoryIds.length === acceptedIds.length &&
      advisoryIds.every((id, index) => id === acceptedIds[index]) &&
      packages[exception.dependencyPath]?.version === exception.affectedVersion &&
      packages[exception.parentPath]?.version === exception.parentVersion
    );
  });

  if (!match) {
    remaining.push({
      name: finding.name,
      severity: finding.severity,
      nodes: finding.nodes || [],
      reason: `no scoped exception matches advisories ${advisoryIds.join(", ") || "none"}`,
    });
    continue;
  }

  accepted.push({
    advisoryIds,
    exception: match,
    finding,
  });
}

if (remaining.length > 0) {
  for (const finding of remaining) {
    console.error(
      `FAIL unaccepted ${finding.severity} finding ${finding.name} at ${finding.nodes.join(", ") || "<no-node>"} (${finding.reason})`,
    );
  }
  process.exit(1);
}

for (const entry of accepted) {
  console.log("[audit] accepted scoped production-context exception");
  console.log("  warning: accepted temporarily, not fixed");
  console.log(`  advisory: ${entry.advisoryIds.join(", ")}`);
  console.log(`  package: ${entry.exception.package}`);
  console.log(`  path: ${entry.exception.dependencyPath}`);
  console.log(`  parent: ${entry.exception.parentName}@${entry.exception.parentVersion}`);
  console.log(`  affected version: ${entry.exception.affectedVersion}`);
  console.log(`  context: ${entry.exception.context}`);
  console.log(`  expiry: ${entry.exception.expiryDate}`);
  console.log(`  owner role: ${entry.exception.ownerRole}`);
  console.log(`  revalidation triggers: ${entry.exception.revalidationTriggers.join(" | ")}`);
}

console.log("PASS root production audit only contains exact accepted scoped high finding(s)");
NODE
rm -f "${audit_json}"
trap - EXIT

for context in "${contexts[@]}"; do
  echo "[audit] ${context}"
  temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/ai-chatbot-audit-${context//\//-}.XXXXXX")"
  trap 'rm -rf "${temp_dir}"' EXIT
  cp "${ROOT_DIR}/${context}/package.json" "${ROOT_DIR}/${context}/package-lock.json" "${temp_dir}/"
  (
    cd "${temp_dir}"
    if [[ "${context}" == "apps/dashboard" ]]; then
      npm ci --workspaces=false --ignore-scripts --audit=false --fund=false --omit=optional
      npm audit --omit=dev --omit=optional --workspaces=false
    else
      npm ci --workspaces=false --ignore-scripts --audit=false --fund=false
      npm audit --omit=dev --workspaces=false
    fi
  )
  rm -rf "${temp_dir}"
  trap - EXIT
  echo "PASS ${context}"
done
