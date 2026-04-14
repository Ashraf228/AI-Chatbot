"use client";

import { useState, type CSSProperties } from "react";

export function ReportTriggerButton({ siteId }: { siteId?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function trigger() {
    setState("loading");
    const res = await fetch("/api/widget/reports/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, frequency: "weekly" }),
    });
    setState(res.ok ? "done" : "error");
  }

  return (
    <button onClick={trigger} style={buttonStyle}>
      {state === "loading"
        ? "Wird ausgelöst..."
        : state === "done"
          ? "Report ausgelöst"
          : state === "error"
            ? "Erneut versuchen"
            : "Report auslösen"}
    </button>
  );
}

const buttonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};
