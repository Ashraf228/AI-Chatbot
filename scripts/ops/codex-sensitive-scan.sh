#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/ops/codex-sensitive-scan.sh [--base <ref>] [--head <ref>]
EOF
}

base_ref=""
head_ref=""

while (($# > 0)); do
  case "$1" in
    --base)
      shift
      base_ref="${1:-}"
      ;;
    --head)
      shift
      head_ref="${1:-}"
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

tmp_files="$(mktemp)"
tmp_patterns="$(mktemp)"
trap 'rm -f "$tmp_files" "$tmp_patterns"' EXIT

if [[ -n "$base_ref" ]]; then
  if [[ -n "$head_ref" ]]; then
    git diff --name-only "$base_ref..$head_ref" >"$tmp_files"
  else
    git diff --name-only "$base_ref..HEAD" >"$tmp_files"
  fi
else
  {
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  } | awk 'NF' | sort -u >"$tmp_files"
fi

if [[ ! -s "$tmp_files" ]]; then
  echo "[sensitive-scan] no changed files to scan"
  exit 0
fi

echo "[sensitive-scan] scanning changed files"

printf '%s\n' \
  "BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE"' KEY' \
  "AK"'IA[0-9A-Z]{16}' \
  "AI"'za[0-9A-Za-z_-]{35}' \
  "sk_"'live_[0-9A-Za-z]+' \
  "gh"'p_[0-9A-Za-z]+' \
  "-----BEGIN PRIVATE"' KEY-----' \
  >"$tmp_patterns"

while IFS= read -r path; do
  [[ -n "$path" ]] || continue

  case "$path" in
    .env|.env.*|*.pem|*.key|*.p12|*.bak|*.backup|*.sqlite|*.db|*.dump|*.csv)
      echo "[sensitive-scan] FAIL: forbidden file path $path" >&2
      exit 1
      ;;
  esac

  if [[ -f "$path" ]]; then
    if rg -n -I -m 1 -f "$tmp_patterns" "$path" >/dev/null; then
      echo "[sensitive-scan] FAIL: secret-like content in $path" >&2
      exit 1
    fi
  fi
done <"$tmp_files"

echo "[sensitive-scan] PASS"
