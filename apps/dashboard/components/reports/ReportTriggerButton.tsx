"use client";

import { useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";

export function ReportTriggerButton({ siteId }: { siteId?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    setState("loading");
    setError(null);
    const res = await fetch("/api/widget/reports/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, frequency: "weekly" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setState("error");
      setError(data?.message || "Report konnte nicht versendet werden.");
      return;
    }
    setState("done");
  }

  return (
    <div className="dashboard-stack dashboard-stack--sm" style={{ alignItems: "flex-end" }}>
      <Button onClick={trigger}>
        {state === "loading"
          ? "Wird ausgelöst..."
          : state === "done"
            ? "Report versendet"
            : state === "error"
              ? "Erneut versuchen"
              : "Report auslösen"}
      </Button>
      {error ? <ErrorState message={error} /> : null}
    </div>
  );
}
