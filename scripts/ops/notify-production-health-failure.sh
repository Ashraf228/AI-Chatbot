#!/usr/bin/env bash
set -Eeuo pipefail

ALERT_ENV_FILE="${ALERT_ENV_FILE:-/root/AI-Chatbot/.env}"
CHECK_NAME="${CHECK_NAME:-production-health}"
CHECK_STATUS="${CHECK_STATUS:-FAIL}"
CHECK_HINT="${CHECK_HINT:-No details provided. Check journalctl for the failing service.}"
TEST_ALERT="${TEST_ALERT:-0}"

export ALERT_ENV_FILE CHECK_NAME CHECK_STATUS CHECK_HINT TEST_ALERT
export ALERT_HOSTNAME="${ALERT_HOSTNAME:-$(hostname -f 2>/dev/null || hostname)}"
export ALERT_TIMESTAMP="${ALERT_TIMESTAMP:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"

if [[ ! -f "$ALERT_ENV_FILE" ]]; then
  printf 'FAIL alert env file missing\n' >&2
  exit 1
fi

python3 - <<'PY'
from __future__ import annotations

import json
import os
import smtplib
import ssl
import sys
import urllib.request
from email.message import EmailMessage
from pathlib import Path


def load_env_file(path: str) -> None:
    env_path = Path(path)
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def clean_hint(value: str) -> str:
    compact = " ".join(value.replace("\r", " ").replace("\n", " ").split())
    return compact[:1500] or "No details provided. Check journalctl for the failing service."


def get_first(*names: str) -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return ""


load_env_file(os.environ["ALERT_ENV_FILE"])

check_name = os.environ.get("CHECK_NAME", "production-health")
check_status = os.environ.get("CHECK_STATUS", "FAIL")
check_hint = clean_hint(os.environ.get("CHECK_HINT", ""))
host = os.environ.get("ALERT_HOSTNAME", "unknown-host")
timestamp = os.environ.get("ALERT_TIMESTAMP", "")
is_test = os.environ.get("TEST_ALERT", "0") == "1"
subject_prefix = "[TEST] " if is_test else ""
subject = f"{subject_prefix}AI Chatbot {check_status}: {check_name}"
text = (
    f"AI Chatbot production alert\n"
    f"Host: {host}\n"
    f"Time UTC: {timestamp}\n"
    f"Check: {check_name}\n"
    f"Status: {check_status}\n"
    f"Hint: {check_hint}\n"
)

webhook_url = get_first("ALERT_WEBHOOK_URL", "MONITORING_ALERT_WEBHOOK_URL")
if webhook_url:
    payload = json.dumps(
        {
            "service": "ai-chatbot",
            "host": host,
            "timeUtc": timestamp,
            "check": check_name,
            "status": check_status,
            "hint": check_hint,
            "test": is_test,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status >= 400:
            raise RuntimeError(f"webhook returned http {response.status}")
    print("OK alert sent via webhook")
    sys.exit(0)

smtp_host = os.environ.get("SMTP_HOST", "")
smtp_user = os.environ.get("SMTP_USER", "")
smtp_pass = os.environ.get("SMTP_PASS", "")
smtp_from = get_first("ALERT_FROM_EMAIL", "REPORTS_FROM_EMAIL", "SMTP_FROM_EMAIL", "SMTP_USER")
smtp_to = get_first("ALERT_TO_EMAIL", "MONITORING_ALERT_EMAIL", "ADMIN_EMAIL")
smtp_port = int(os.environ.get("SMTP_PORT", "587") or "587")

if not (smtp_host and smtp_user and smtp_pass and smtp_from and smtp_to):
    print("FAIL no alert channel configured", file=sys.stderr)
    sys.exit(1)

message = EmailMessage()
message["From"] = smtp_from
message["To"] = smtp_to
message["Subject"] = subject
message.set_content(text)

if smtp_port == 465:
    with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20, context=ssl.create_default_context()) as smtp:
        smtp.login(smtp_user, smtp_pass)
        smtp.send_message(message)
else:
    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
        smtp.ehlo()
        if os.environ.get("SMTP_STARTTLS", "true").lower() not in {"0", "false", "no"}:
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        smtp.login(smtp_user, smtp_pass)
        smtp.send_message(message)

print("OK alert sent via smtp")
PY
