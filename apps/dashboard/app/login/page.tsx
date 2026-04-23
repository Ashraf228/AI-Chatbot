"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "../../components/shared/Button";
import { Input } from "../../components/shared/Input";
import { ErrorState } from "../../components/shared/ErrorState";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErr(null);
    setIsSubmitting(true);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      const data = (await r.json().catch(() => null)) as { message?: string } | null;

      if (!r.ok) {
        setErr(data?.message ?? "Login fehlgeschlagen");
        setIsSubmitting(false);
        return;
      }

      window.location.assign("/sites");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setErr("Login-Zeitüberschreitung. Bitte erneut versuchen.");
      } else {
        setErr("Serverfehler beim Login");
      }

      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-auth">
      <div className="dashboard-auth-card">
        <div className="dashboard-auth-logo">
          <Image
            src="/soule-logo.png"
            alt="SSB Soule"
            width={132}
            height={132}
            style={{ width: 132, height: 132, objectFit: "contain" }}
            priority
          />
        </div>

        <p className="dashboard-eyebrow">Soulé Admin</p>
        <h1 className="dashboard-auth-title">Willkommen zurück</h1>
        <p className="dashboard-copy" style={{ marginTop: 0 }}>
          Melde dich an, um Kunden-Sites, Leads, Reports und Widget-Einstellungen zu verwalten.
        </p>

        <form onSubmit={onLogin} className="dashboard-stack">
          <Input
            type="password"
            placeholder="Passwort"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Einloggen..." : "Login"}
          </Button>
        </form>

        {err && <ErrorState message={err} />}
      </div>
    </div>
  );
}
