"use client";

import { useState } from "react";
import { Button } from "../shared/Button";

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
    <Button onClick={trigger}>
      {state === "loading"
        ? "Wird ausgelöst..."
        : state === "done"
          ? "Report ausgelöst"
          : state === "error"
            ? "Erneut versuchen"
            : "Report auslösen"}
    </Button>
  );
}
